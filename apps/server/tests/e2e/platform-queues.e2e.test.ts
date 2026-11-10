import { Injectable, type OnModuleInit } from '@nestjs/common';
import { bullMqJobOptions, isLastAttempt, PlatformJobsPlugin, PlatformQueues } from '@cod/plugin-platform-jobs';
import { type DurableJobData, durableJobId } from '@cod/shared';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bullMqOptions } from '../../src/config/redis.config';
import {
  buildE2eConfig,
  E2E_INITIAL_DATA,
  e2eBullPrefix,
  e2eEnv,
  e2ePoolPrefix,
  e2eRedis,
  removeBullKeys,
  useE2ePlatformJobs,
  VENDURE_BULLMQ_QUEUE,
} from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

const SUITE = 'platform-queues';
/** `documents` is a bulk queue with 3 attempts that no feature uses yet. */
const QUEUE = 'documents';
const ATTEMPTS = 3;
const TEST_BACKOFF_MS = 50;
const REQUEUE_DELAY_MS = 1_500;
const SETTLE_TIMEOUT_MS = 20_000;
const POLL_MS = 50;

interface Run {
  readonly jobId: string;
  readonly attempts: number;
  readonly retries: number;
  readonly last: boolean;
  readonly at: number;
}

interface ProbeData extends DurableJobData {
  readonly fail: boolean;
}

const runs: Run[] = [];

/** A queue whose processor records how it was called and fails when its data says so. */
@Injectable()
class ProbeConsumer implements OnModuleInit {
  constructor(private readonly queues: PlatformQueues) {}

  onModuleInit(): void {
    this.queues.define<ProbeData>(QUEUE, (data, job) => {
      runs.push({ jobId: data.jobId, ...job, last: isLastAttempt(job), at: Date.now() });
      return data.fail ? Promise.reject(new Error('probe failure')) : Promise.resolve();
    });
  }
}

@VendurePlugin({ imports: [PluginCommonModule, PlatformJobsPlugin], providers: [ProbeConsumer] })
// A Vendure plugin is a decorated class; its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class ProbePlugin {}

const waitFor = async (predicate: () => boolean | Promise<boolean>): Promise<void> => {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the job');
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
};

describe('platform queues on the real BullMQ strategy', () => {
  const { server } = createTestEnvironment(
    buildE2eConfig({ plugins: [ProbePlugin] }, { suite: SUITE, port: E2E_PORTS.platformQueues }),
  );
  const redis = e2eRedis();
  const bullQueue = new Queue(VENDURE_BULLMQ_QUEUE, { prefix: e2ePoolPrefix(SUITE, 'bulk'), connection: redis });
  const runsOf = (jobId: string): Run[] => runs.filter((run) => run.jobId === jobId);

  beforeAll(async () => {
    // The registry's options with a test-sized backoff, so three attempts fit in a test.
    const registryOptions = bullMqJobOptions();
    useE2ePlatformJobs(SUITE, e2eEnv(), {
      ...bullMqOptions(e2eEnv()),
      setJobOptions: (queueName, job) => ({
        ...registryOptions(queueName, job),
        backoff: { type: 'exponential', delay: TEST_BACKOFF_MS },
      }),
    });
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
  });

  afterAll(async () => {
    await server.destroy();
    await bullQueue.close();
    await removeBullKeys(e2eBullPrefix(SUITE));
    redis.disconnect();
  });

  it('numbers the runs of a failing job from 1 and flags only the last as the last attempt', async () => {
    // Arrange
    const jobId = durableJobId('od', '1', 'probe');

    // Act
    await server.app.get(PlatformQueues).add(QUEUE, { jobId, fail: true } satisfies ProbeData);
    await waitFor(() => runsOf(jobId).length >= ATTEMPTS);

    // Assert
    const seen = runsOf(jobId);
    expect(seen.map((run) => run.attempts)).toEqual([1, 2, 3]);
    expect(seen.map((run) => run.retries)).toEqual([2, 2, 2]);
    expect(seen.map((run) => run.last)).toEqual([false, false, true]);
  }, 30_000);

  it('delays a continuation by the requested time', async () => {
    // Arrange
    const first = durableJobId('od', '2', 'probe');
    const continuation = `${first}-r1`;
    const queuedAt = Date.now();

    // Act
    await server.app
      .get(PlatformQueues)
      .requeueWithDelay(QUEUE, { jobId: first, fail: false } satisfies ProbeData, REQUEUE_DELAY_MS);
    const state = await bullQueue.getJob(continuation).then((job) => job?.getState());
    await waitFor(() => runsOf(continuation).length >= 1);

    // Assert
    expect(state).toBe('delayed');
    expect(runsOf(continuation)[0]?.at).toBeGreaterThanOrEqual(queuedAt + REQUEUE_DELAY_MS - 100);
  }, 30_000);
});
