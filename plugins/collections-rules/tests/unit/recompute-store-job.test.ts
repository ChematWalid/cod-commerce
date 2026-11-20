import type { BusinessSemaphore, PlatformQueues } from '@cod/plugin-platform-jobs';
import { PLATFORM_CLOCK, SemaphoreBusyError, TASK_HEARTBEAT_WRITER } from '@cod/plugin-platform-jobs';
import { NORMAL_FORM_VERSION, type QueueName, type Snowflake, toSnowflake } from '@cod/shared';
import type { Injector, RequestContext } from '@vendure/core';
import { RequestContextService } from '@vendure/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecomputeStoreService } from '../../application/recompute-store.service';
import { ReconcileSweepService } from '../../application/reconcile-sweep.service';
import type { IdGeneratorPort } from '../../domain/ports/id-generator.port';
import type { StoreScope } from '../../domain/store-scope';
import { MatchVersionCheck, collectionsReconcileTask } from '../../infrastructure/reconcile.task';
import { PlatformStoreReconcileQueue, RecomputeStoreJob } from '../../infrastructure/recompute-store.job';
import type { StoreChannelContexts } from '../../infrastructure/store-channel-context';
import { scopeA, scopeB } from '../support/builders';

/** 2026-11-20 23:59:59.000 UTC. */
const LATE_ON_THE_20TH = Date.UTC(2026, 10, 20, 23, 59, 59);
const ONE_MINUTE_MS = 60_000;

type Processor = (data: unknown) => Promise<void>;

/** Records what is queued, and the processor the job defines. */
class RecordingQueues {
  readonly added: { queue: QueueName; data: { jobId: string; delayMs?: number } }[] = [];
  readonly requeued: { queue: QueueName; data: unknown; delayMs: number }[] = [];
  processor: Processor | undefined;

  define(_queue: QueueName, process: Processor): void {
    this.processor = process;
  }

  add(queue: QueueName, data: { jobId: string; delayMs?: number }): Promise<void> {
    this.added.push({ queue, data });
    return Promise.resolve();
  }

  requeueWithDelay(queue: QueueName, data: unknown, delayMs: number): Promise<void> {
    this.requeued.push({ queue, data, delayMs });
    return Promise.resolve();
  }
}

class CountingIds implements IdGeneratorPort {
  private next_ = 1_700_000_000_000_000_000n;

  next(): Snowflake {
    this.next_ += 1n;
    return toSnowflake(String(this.next_));
  }
}

let queues: RecordingQueues;
let clock: { now: () => number };

beforeEach(() => {
  queues = new RecordingQueues();
  clock = { now: () => LATE_ON_THE_20TH };
});

const reconcileQueue = (): PlatformStoreReconcileQueue =>
  new PlatformStoreReconcileQueue(queues as unknown as PlatformQueues, new CountingIds(), clock);

const jobIds = (): string[] => queues.added.map((entry) => entry.data.jobId);

describe('PlatformStoreReconcileQueue job ids (ADR 0013 amendment)', () => {
  it('a version reconcile has one id per store and version', async () => {
    // Arrange
    const queue = reconcileQueue();

    // Act
    await queue.enqueue(scopeA, 'version');
    await queue.enqueue(scopeA, 'version');

    // Assert
    expect(jobIds()).toEqual([
      `crs-${scopeA.storeId}-v${String(NORMAL_FORM_VERSION)}`,
      `crs-${scopeA.storeId}-v${String(NORMAL_FORM_VERSION)}`,
    ]);
    expect(queues.added.map((entry) => entry.queue)).toEqual(['catalog-reconcile', 'catalog-reconcile']);
    expect(queues.added.map((entry) => entry.data.delayMs)).toEqual([undefined, undefined]);
  });

  it('a nightly reconcile has one id per store and UTC day', async () => {
    // Arrange
    const queue = reconcileQueue();

    // Act
    await queue.enqueue(scopeA, 'nightly');
    await queue.enqueue(scopeA, 'nightly');
    clock.now = () => LATE_ON_THE_20TH + ONE_MINUTE_MS;
    await queue.enqueue(scopeA, 'nightly');

    // Assert
    expect(jobIds()).toEqual([
      `crs-${scopeA.storeId}-n20261120`,
      `crs-${scopeA.storeId}-n20261120`,
      `crs-${scopeA.storeId}-n20261121`,
    ]);
  });

  it('failed-delivery reconciles of one store in one UTC hour share an id', async () => {
    // Arrange
    const queue = reconcileQueue();

    // Act
    await queue.enqueue(scopeA, 'delivery');
    await queue.enqueue(scopeA, 'delivery');
    await queue.enqueue(scopeB, 'delivery');

    // Assert
    expect(jobIds()).toEqual([
      `crs-${scopeA.storeId}-d2026112023`,
      `crs-${scopeA.storeId}-d2026112023`,
      `crs-${scopeB.storeId}-d2026112023`,
    ]);
  });

  it('a failed-delivery reconcile starts at the next UTC hour, after every failure of its hour', async () => {
    // Arrange
    const queue = reconcileQueue();
    const [earlyInTheHour, laterInTheHour, nextHour] = [
      Date.UTC(2026, 10, 20, 14, 5),
      Date.UTC(2026, 10, 20, 14, 50),
      Date.UTC(2026, 10, 20, 15),
    ];

    // Act
    clock.now = () => earlyInTheHour;
    await queue.enqueue(scopeA, 'delivery');
    clock.now = () => laterInTheHour;
    await queue.enqueue(scopeA, 'delivery');

    // Assert: both share one job, which starts at the next hour, after the later failure
    const [first, second] = queues.added.map((entry) => entry.data);
    expect(second?.jobId).toBe(first?.jobId);
    expect(earlyInTheHour + (first?.delayMs ?? 0)).toBe(nextHour);
  });

  it('a save reconcile gets a new id each time', async () => {
    // Arrange
    const queue = reconcileQueue();

    // Act
    await queue.enqueue(scopeA, 'save');
    await queue.enqueue(scopeA, 'save');

    // Assert
    const [first, second] = jobIds();
    expect(first).toMatch(new RegExp(`^crs-${scopeA.storeId}-\\d+$`));
    expect(second).not.toBe(first);
    expect(queues.added.map((entry) => entry.data.delayMs)).toEqual([undefined, undefined]);
  });
});

/** Store `scopeA.storeId` belongs to business A; any other pairing is unknown, like `settingsOf`. */
const ownerOf = new Map<string, string>([[scopeA.storeId, scopeA.businessId]]);

describe('RecomputeStoreJob (D2336, D103)', () => {
  let rebuilt: StoreScope[];
  let run: (ctx: unknown, scope: StoreScope) => Promise<number>;
  let busy: boolean;

  const processor = (): Processor => {
    const semaphore = {
      withBusinessSemaphore: <T>(_key: unknown, _limit: number, work: () => Promise<T>): Promise<T> =>
        busy ? Promise.reject(new SemaphoreBusyError(1_000)) : work(),
    } as unknown as BusinessSemaphore;
    const contexts = {
      forJob: (businessId: string, storeId: string) =>
        Promise.resolve(ownerOf.get(storeId) === businessId ? ({} as RequestContext) : undefined),
    } as unknown as StoreChannelContexts;
    const stores = { run: (ctx: unknown, scope: StoreScope) => run(ctx, scope) } as unknown as RecomputeStoreService;
    new RecomputeStoreJob(queues as unknown as PlatformQueues, semaphore, contexts, stores).onModuleInit();
    if (queues.processor === undefined) throw new Error('the job defines its processor at module init');
    return queues.processor;
  };

  const jobOf = (scope: StoreScope) => ({ jobId: 'crs-1001-n20261120', ...scope });

  beforeEach(() => {
    rebuilt = [];
    busy = false;
    run = (_ctx, scope) => {
      rebuilt.push(scope);
      return Promise.resolve(1);
    };
  });

  it("rebuilds the store on its business's channel", async () => {
    // Act
    await processor()(jobOf(scopeA));

    // Assert
    expect(rebuilt).toEqual([scopeA]);
  });

  it('a busy business re-queues the job as a continuation with a delay and does not rebuild', async () => {
    // Arrange
    busy = true;

    // Act
    await processor()(jobOf(scopeA));

    // Assert
    expect(rebuilt).toEqual([]);
    expect(queues.requeued).toHaveLength(1);
    expect(queues.requeued[0]?.queue).toBe('catalog-reconcile');
    expect(queues.requeued[0]?.data).toEqual(jobOf(scopeA));
    expect(queues.requeued[0]?.delayMs).toBeGreaterThanOrEqual(5_000);
    expect(queues.requeued[0]?.delayMs).toBeLessThanOrEqual(30_000);
  });

  it('a malformed payload is dropped without rebuilding', async () => {
    // Act
    await processor()({ jobId: 'crs-x', businessId: 'not-an-id', storeId: scopeA.storeId });

    // Assert
    expect(rebuilt).toEqual([]);
    expect(queues.requeued).toEqual([]);
  });

  it('an archived or missing store is acknowledged without rebuilding', async () => {
    // Act
    await processor()(jobOf({ businessId: scopeA.businessId, storeId: '1999' } as StoreScope));

    // Assert
    expect(rebuilt).toEqual([]);
  });

  it("a job naming another business's store rebuilds nothing", async () => {
    // Act
    await processor()(jobOf({ businessId: scopeB.businessId, storeId: scopeA.storeId }));

    // Assert
    expect(rebuilt).toEqual([]);
  });

  it('a rebuild failure is rethrown for the queue to retry', async () => {
    // Arrange
    const failure = new Error('database down');
    run = () => Promise.reject(failure);

    // Act
    const act = processor()(jobOf(scopeA));

    // Assert
    await expect(act).rejects.toBe(failure);
    expect(queues.requeued).toEqual([]);
  });
});

describe('the reconcile sweeps at bootstrap and every night (D2336)', () => {
  const createContext = { create: () => Promise.resolve({} as RequestContext) };

  it('a failing match version check is logged, not thrown', async () => {
    // Arrange
    const sweep = { enqueueStale: () => Promise.reject(new Error('valkey down')) } as unknown as ReconcileSweepService;
    const check = new MatchVersionCheck(createContext as unknown as RequestContextService, sweep);
    const checked = vi.spyOn(check, 'check');

    // Act
    const act = (): void => {
      check.onApplicationBootstrap();
    };

    // Assert
    expect(act).not.toThrow();
    await expect(checked.mock.results[0]?.value).rejects.toThrow('valkey down');
  });

  it('the nightly task queues every store through the sweep', async () => {
    // Arrange
    const enqueueAll = vi.fn(() => Promise.resolve(3));
    const services = new Map<unknown, unknown>([
      [RequestContextService, createContext],
      [ReconcileSweepService, { enqueueAll }],
      [PLATFORM_CLOCK, clock],
      [TASK_HEARTBEAT_WRITER, { recordSuccess: () => Promise.resolve() }],
    ]);
    const injector = { get: (token: unknown) => services.get(token) } as unknown as Injector;

    // Act
    const result: unknown = await collectionsReconcileTask.options.execute({
      injector,
      scheduledContext: undefined as never,
      params: {},
    });

    // Assert
    expect(enqueueAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ stores: 3 });
  });
});
