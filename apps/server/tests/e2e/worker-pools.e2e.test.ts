import { parsePooledJobId, PooledJobQueueStrategy } from '@cod/plugin-platform-jobs';
import { activeQueuesFor, type QueuePool } from '@cod/shared';
import { ModuleRef } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import { Injector, type Job as VendureJob, JobQueueService, ProcessContext } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { Queue } from 'bullmq';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bullMqOptions } from '../../src/config/redis.config';
import { PoolProbePlugin, PoolProbeService, type ProbeResult } from './fixtures/queue-probe.plugin';
import {
  buildE2eConfig,
  E2E_INITIAL_DATA,
  e2eAppEnv,
  e2eBullPrefix,
  e2eEnv,
  e2ePoolPrefix,
  e2eRedis,
  removeBullKeys,
  VENDURE_BULLMQ_QUEUE,
} from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

const SUITE = 'worker-pools';
/** How long a job of the other pool must stay untouched to count as left for that pool's worker. */
const UNTOUCHED_FOR_MS = 3000;
const POLL_INTERVAL_MS = 100;
const SETTLE_TIMEOUT_MS = 15_000;
/** Valkey database of the new Valkey tests (plan, Global Constraints); this file deletes only its own keys. */
const VALKEY_TEST_DATABASE = '12';

const JOBS = gql`
  query PooledJobs {
    jobs(options: { take: 50 }) {
      items {
        id
        queueName
        state
      }
      totalItems
    }
  }
`;

const JOB = gql`
  query PooledJob($id: ID!) {
    job(jobId: $id) {
      id
      queueName
    }
  }
`;

interface ListedJob {
  readonly id: string;
  readonly queueName: string;
  readonly state: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function onTestDatabase(redisUrl: string): string {
  const url = new URL(redisUrl);
  url.pathname = `/${VALKEY_TEST_DATABASE}`;
  return url.toString();
}

/** The process context of a worker, so this test's bulk strategy keeps the job list index as a worker does. */
class WorkerProcessContext extends ProcessContext {
  override get isServer(): boolean {
    return false;
  }

  override get isWorker(): boolean {
    return true;
  }
}

/** The app's injector, except that it answers a worker's process context. */
class WorkerInjector extends Injector {
  // The signature is Injector's, which this class overrides.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  override get<T, R = T>(typeOrToken: Type<T> | string | symbol): R {
    return typeOrToken === ProcessContext ? (new WorkerProcessContext() as R) : super.get<T, R>(typeOrToken);
  }
}

describe('worker pools on BullMQ (D97)', () => {
  const env = e2eEnv({ env: { REDIS_URL: onTestDatabase(e2eEnv().REDIS_URL) } });
  const { server, adminClient } = createTestEnvironment(
    buildE2eConfig(
      { jobQueueOptions: { activeQueues: [...activeQueuesFor('critical')] }, plugins: [PoolProbePlugin] },
      { suite: SUITE, port: E2E_PORTS.workerPools, env: { REDIS_URL: env.REDIS_URL } },
    ),
  );
  const redis = e2eRedis(env);
  const bullQueues: Record<QueuePool, Queue> = {
    critical: new Queue(VENDURE_BULLMQ_QUEUE, { prefix: e2ePoolPrefix(SUITE, 'critical'), connection: redis }),
    bulk: new Queue(VENDURE_BULLMQ_QUEUE, { prefix: e2ePoolPrefix(SUITE, 'bulk'), connection: redis }),
  };
  let bulkWorker: PooledJobQueueStrategy | undefined;

  /** The BullMQ state of a job given its pooled id. */
  async function stateOf(pooledId: string): Promise<string> {
    const parsed = parsePooledJobId(pooledId);
    if (parsed === undefined) throw new Error(`${pooledId} is not a pooled job id`);
    return bullQueues[parsed.pool].getJobState(parsed.bullId);
  }

  async function settledState(pooledId: string): Promise<string> {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let state = await stateOf(pooledId);
    while (['waiting', 'active', 'delayed', 'prioritized'].includes(state) && Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      state = await stateOf(pooledId);
    }
    return state;
  }

  /** Polls the Admin API job list until it holds every id (the index is kept asynchronously). */
  async function listedJobs(ids: readonly string[]): Promise<ListedJob[]> {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    for (;;) {
      const { jobs } = await adminClient.query<{ jobs: { items: ListedJob[] } }>(JOBS);
      if (ids.every((id) => jobs.items.some((job) => job.id === id)) || Date.now() > deadline) return jobs.items;
      await sleep(POLL_INTERVAL_MS);
    }
  }

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await adminClient.asUserWithCredentials(env.SUPERADMIN_USERNAME, env.SUPERADMIN_PASSWORD);
  });

  afterAll(async () => {
    await bulkWorker?.destroy();
    await server.destroy();
    await Promise.all(Object.values(bullQueues).map((queue) => queue.close()));
    await removeBullKeys(e2eBullPrefix(SUITE));
    redis.disconnect();
  });

  it('a critical process runs the critical pool, auth-email included, and leaves bulk jobs waiting', async () => {
    // Arrange
    const probes = server.app.get(PoolProbeService);

    // Act
    const criticalId = await probes.enqueue('order-effects');
    const bulkId = await probes.enqueue('analytics');
    const criticalState = await settledState(criticalId);
    await sleep(UNTOUCHED_FOR_MS);

    // Assert
    expect(criticalId).toMatch(/^critical\./);
    expect(bulkId).toMatch(/^bulk\./);
    expect(criticalState).toBe('completed');
    expect(await stateOf(bulkId)).toBe('waiting');
    const running = new Map(
      server.app
        .get(JobQueueService)
        .getJobQueues()
        .map((queue) => [queue.name, queue.running]),
    );
    expect(running.get('auth-email')).toBe(true);
    expect(running.get('analytics')).toBe(false);
  });

  it('a bulk worker completes the waiting bulk job, and the Admin API lists and finds both pools', async () => {
    // Arrange
    const probes = server.app.get(PoolProbeService);
    const criticalId = await probes.enqueue('order-effects');
    const bulkId = await probes.enqueue('analytics');
    expect(await settledState(criticalId)).toBe('completed');
    bulkWorker = new PooledJobQueueStrategy({ appEnv: e2eAppEnv(SUITE), bullMq: bullMqOptions(env) });
    bulkWorker.startPools(['bulk']);

    // Act
    await bulkWorker.init(new WorkerInjector(server.app.get(ModuleRef)));
    await bulkWorker.start('analytics', (job: VendureJob): Promise<ProbeResult> => {
      return Promise.resolve({ processedBy: `bulk worker: ${job.queueName}` });
    });
    const bulkState = await settledState(bulkId);
    const listed = await listedJobs([criticalId, bulkId]);
    const found = await Promise.all(
      [criticalId, bulkId].map(
        async (id) => (await adminClient.query<{ job: { id: string } | null }>(JOB, { id })).job,
      ),
    );

    // Assert
    expect(bulkState).toBe('completed');
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: criticalId, queueName: 'order-effects', state: 'COMPLETED' }),
        expect.objectContaining({ id: bulkId, queueName: 'analytics', state: 'COMPLETED' }),
      ]),
    );
    expect(found).toEqual([expect.objectContaining({ id: criticalId }), expect.objectContaining({ id: bulkId })]);
  });
});
