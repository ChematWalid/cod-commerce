import { isQueueName, QUEUE_POOLS, type QueuePool, QUEUES } from '@cod/shared';
import {
  ConfigService,
  type ID,
  type Injector,
  type InspectableJobQueueStrategy,
  Job,
  type JobData,
  Logger,
  type PaginatedList,
} from '@vendure/core';
import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';
// D97: deep imports into the job-queue plugin (it has no `exports` map): one stock strategy per pool, and the
// name and default concurrency of the one BullMQ queue that strategy keeps every Vendure queue in.
import { BullMQJobQueueStrategy } from '@vendure/job-queue-plugin/package/bullmq/bullmq-job-queue-strategy';
import { DEFAULT_CONCURRENCY, QUEUE_NAME } from '@vendure/job-queue-plugin/package/bullmq/constants';
import { Queue } from 'bullmq';
import { BULL_PREFIX_ROOT, KEEP_COMPLETED_JOBS, KEEP_FAILED_JOBS } from '../domain/constants';
import { UnregisteredQueueError } from '../domain/errors';
import { mergeNewestFirst } from '../domain/newest-first';
import { parsePooledJobId, toPooledJobId } from '../domain/pooled-job-id';
import { bullMqJobOptions } from './job-options';
import { PoolInjector } from './pool-injector';
import { type JobListOptions, queueNamesOf } from './queue-name-filter';

const LOG_CONTEXT = 'PooledJobQueueStrategy';
const DEFAULT_TAKE = 10;

/** How {@link PooledJobQueueStrategy} is built: the environment names the prefixes, the options are BullMQ's. */
export interface PooledJobQueueStrategyOptions {
  readonly appEnv: string;
  readonly bullMq: BullMQPluginOptions;
}

type ProcessFn<Data extends JobData<Data>> = (job: Job<Data>) => Promise<unknown>;

interface Pool {
  readonly strategy: BullMQJobQueueStrategy;
  readonly injector: PoolInjector;
  readonly options: BullMQPluginOptions;
}

/** The BullMQ key prefix of one pool: `bull:{APP_ENV}:{pool}` (D97). */
export const poolPrefix = (appEnv: string, pool: QueuePool): string => `${BULL_PREFIX_ROOT}:${appEnv}:${pool}`;

const concurrencyOf = (queueName: string): number =>
  isQueueName(queueName) ? QUEUES[queueName].concurrency : DEFAULT_CONCURRENCY;

/**
 * The options of one pool's stock strategy. Both prefixes are set: the stock strategy builds its queue from
 * `queueOptions` and its workers, index and cancellation keys from `workerOptions.prefix`.
 */
export function poolOptionsFor(bullMq: BullMQPluginOptions, appEnv: string, pool: QueuePool): BullMQPluginOptions {
  const prefix = poolPrefix(appEnv, pool);
  return {
    ...bullMq,
    queueOptions: { ...bullMq.queueOptions, prefix },
    workerOptions: {
      removeOnComplete: KEEP_COMPLETED_JOBS,
      removeOnFail: KEEP_FAILED_JOBS,
      ...bullMq.workerOptions,
      prefix,
    },
    concurrency: bullMq.concurrency ?? concurrencyOf,
    setJobOptions: bullMq.setJobOptions ?? bullMqJobOptions(),
  };
}

/** The pool of a registered queue. @throws {@link UnregisteredQueueError} for any other name. */
function poolOf(queueName: string): QueuePool {
  if (!isQueueName(queueName)) throw new UnregisteredQueueError(queueName);
  return QUEUES[queueName].pool;
}

/** The pools of the registered names among `queueNames`; an empty list means every pool (Vendure's rule). */
function poolsOf(queueNames: readonly string[]): QueuePool[] {
  if (queueNames.length === 0) return [...QUEUE_POOLS];
  return QUEUE_POOLS.filter((pool) => queueNames.some((name) => isQueueName(name) && QUEUES[name].pool === pool));
}

/** The same job under its pooled id `{pool}.{bullId}`. */
function withPooledId<Data extends JobData<Data>>(pool: QueuePool, job: Job<Data>): Job<Data> {
  return new Job<Data>({
    queueName: job.queueName,
    data: job.data,
    id: toPooledJobId(pool, String(job.id)),
    state: job.state,
    retries: job.retries,
    attempts: job.attempts,
    progress: job.progress,
    result: job.result as unknown,
    error: job.error as unknown,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    settledAt: job.settledAt,
  });
}

/**
 * Routes every queue of the registry to one stock BullMQ strategy per pool, each with its own prefix, options
 * and job list index (ADR 0013 addendum, D97). A process starts workers only for its pools, so jobs of another
 * pool wait in their own BullMQ queue instead of failing. Jobs leave the strategy with id `{pool}.{bullId}`.
 */
export class PooledJobQueueStrategy implements InspectableJobQueueStrategy {
  readonly useEntityIdStrategyForJobIds = false;
  private readonly pools = new Map<QueuePool, Pool>();
  private readonly started = new Set<QueuePool>();
  private readonly presenceQueues = new Map<QueuePool, Queue>();
  private allowed: ReadonlySet<QueuePool> | undefined;

  constructor(private readonly options: PooledJobQueueStrategyOptions) {}

  /** Limits the pools whose workers this process may start; by default the pools of `activeQueues`. */
  startPools(pools: readonly QueuePool[]): void {
    this.allowed = new Set(pools);
  }

  async init(injector: Injector): Promise<void> {
    this.allowed ??= new Set(poolsOf(injector.get(ConfigService).jobQueueOptions.activeQueues));
    for (const pool of QUEUE_POOLS) {
      const options = poolOptionsFor(this.options.bullMq, this.options.appEnv, pool);
      const poolInjector = new PoolInjector(injector, options);
      const strategy = new BullMQJobQueueStrategy();
      await strategy.init(poolInjector);
      this.pools.set(pool, { strategy, injector: poolInjector, options });
    }
  }

  async destroy(): Promise<void> {
    await Promise.all([
      ...[...this.pools.values()].map((pool) => pool.strategy.destroy()),
      ...[...this.presenceQueues.values()].map((queue) => queue.close()),
    ]);
  }

  async add<Data extends JobData<Data> = object>(job: Job<Data>): Promise<Job<Data>> {
    const pool = poolOf(job.queueName);
    return withPooledId(pool, await this.poolNamed(pool).strategy.add(job));
  }

  async start<Data extends JobData<Data> = object>(queueName: string, process: ProcessFn<Data>): Promise<void> {
    const pool = poolOf(queueName);
    if (this.allowed !== undefined && !this.allowed.has(pool)) {
      Logger.verbose(`Queue ${queueName} belongs to pool ${pool}, which this process does not run`, LOG_CONTEXT);
      return;
    }
    this.started.add(pool);
    await this.poolNamed(pool).strategy.start(queueName, process);
  }

  async stop<Data extends JobData<Data> = object>(queueName: string, process: ProcessFn<Data>): Promise<void> {
    const pool = poolOf(queueName);
    if (!this.started.has(pool)) return;
    await this.poolNamed(pool).strategy.stop(queueName, process);
  }

  async findOne(id: ID): Promise<Job | undefined> {
    const parsed = parsePooledJobId(id);
    if (parsed === undefined) return undefined;
    const job = await this.poolNamed(parsed.pool).strategy.findOne(parsed.bullId);
    return job === undefined ? undefined : withPooledId(parsed.pool, job);
  }

  async cancelJob(jobId: ID): Promise<Job | undefined> {
    const parsed = parsePooledJobId(jobId);
    if (parsed === undefined) return undefined;
    const job = await this.poolNamed(parsed.pool).strategy.cancelJob(parsed.bullId);
    return job === undefined ? undefined : withPooledId(parsed.pool, job);
  }

  async findMany(options?: JobListOptions): Promise<PaginatedList<Job>> {
    const names = queueNamesOf(options);
    // `queueNamesOf` never answers an empty list, so a filter on unregistered names reads no pool.
    const pools = names === undefined ? [...QUEUE_POOLS] : poolsOf(names);
    const [only] = pools;
    if (only === undefined) return { items: [], totalItems: 0 };
    if (pools.length === 1) return this.pageOf(only, options);
    const skip = options?.skip ?? 0;
    const take = options?.take ?? DEFAULT_TAKE;
    const pages = await Promise.all(pools.map((pool) => this.pageOf(pool, { ...options, skip: 0, take: skip + take })));
    return mergeNewestFirst(pages, skip, take);
  }

  async findManyById(ids: ID[]): Promise<Job[]> {
    const parsed = ids.map(parsePooledJobId).filter((id) => id !== undefined);
    const perPool = await Promise.all(
      QUEUE_POOLS.map(async (pool) => {
        const bullIds = parsed.filter((id) => id.pool === pool).map((id) => id.bullId);
        if (bullIds.length === 0) return [];
        const jobs = await this.poolNamed(pool).strategy.findManyById(bullIds);
        return jobs.map((job) => withPooledId(pool, job));
      }),
    );
    return perPool.flat();
  }

  async removeSettledJobs(queueNames?: string[], olderThan?: Date): Promise<number> {
    const pools = poolsOf(queueNames ?? []);
    const counts = await Promise.all(
      pools.map((pool) => this.poolNamed(pool).strategy.removeSettledJobs(queueNames, olderThan)),
    );
    return counts.reduce((sum, count) => sum + count, 0);
  }

  /** Cleans the job list index of every pool (the pooled `clean-job-queue-index` task). */
  async cleanIndexes(): Promise<{ queueName: string; jobsRemoved: number }[]> {
    const results = await Promise.all(
      [...this.pools.values()].map((pool) => pool.injector.jobListIndex.cleanupIndexedSets()),
    );
    return results.flat();
  }

  /** The BullMQ queue of a pool, for reading and removing jobs by their BullMQ id (job presence, D102). */
  bullQueueOf(pool: QueuePool): Queue {
    const existing = this.presenceQueues.get(pool);
    if (existing !== undefined) return existing;
    const { options } = this.poolNamed(pool);
    const queue = new Queue(QUEUE_NAME, { ...options.queueOptions, connection: options.connection ?? {} });
    this.presenceQueues.set(pool, queue);
    return queue;
  }

  private async pageOf(pool: QueuePool, options: JobListOptions | undefined): Promise<PaginatedList<Job>> {
    const page = await this.poolNamed(pool).strategy.findMany(options);
    return { items: page.items.map((job) => withPooledId(pool, job)), totalItems: page.totalItems };
  }

  private poolNamed(pool: QueuePool): Pool {
    const found = this.pools.get(pool);
    if (found === undefined) throw new Error(`${LOG_CONTEXT} is not initialised: pool ${pool} has no strategy`);
    return found;
  }
}
