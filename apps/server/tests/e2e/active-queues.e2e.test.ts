import { createTestEnvironment } from '@vendure/testing';
import { type Job, Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ProbeQueueName, QueueProbePlugin, QueueProbeService } from './fixtures/queue-probe.plugin';
import {
  buildE2eConfig,
  E2E_INITIAL_DATA,
  e2eBullPrefix,
  e2eRedis,
  removeBullKeys,
  VENDURE_BULLMQ_QUEUE,
} from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

const SUITE = 'active-queues';
const PREFIX = e2eBullPrefix(SUITE);

/** How long a job of an inactive queue must stay untouched to count as left for another pool. */
const UNTOUCHED_FOR_MS = 3000;
const POLL_INTERVAL_MS = 100;
const SETTLE_TIMEOUT_MS = 10_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe('worker activeQueues with the BullMQ job queue', () => {
  const { server } = createTestEnvironment(
    buildE2eConfig(
      { jobQueueOptions: { activeQueues: ['probe-critical'] }, plugins: [QueueProbePlugin] },
      { suite: SUITE, port: E2E_PORTS.activeQueues },
    ),
  );
  const redis = e2eRedis();
  // A raw BullMQ view of the one queue Vendure's plugin puts every Vendure queue into.
  const bullQueue = new Queue(VENDURE_BULLMQ_QUEUE, { prefix: PREFIX, connection: redis });

  const enqueue = (name: ProbeQueueName): Promise<string> => server.app.get(QueueProbeService).enqueue(name);

  async function jobOf(id: string): Promise<Job> {
    const job = await bullQueue.getJob(id);
    if (job === undefined) {
      throw new Error(`BullMQ has no job ${id}`);
    }
    return job;
  }

  /** Polls until the job leaves `waiting`/`active`, and returns the settled job and state. */
  async function settled(id: string): Promise<{ job: Job; state: string }> {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    for (;;) {
      const state = await bullQueue.getJobState(id);
      if (!['waiting', 'active', 'delayed', 'prioritized'].includes(state) || Date.now() > deadline) {
        return { job: await jobOf(id), state };
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
  });

  afterAll(async () => {
    await server.destroy();
    await bullQueue.close();
    await removeBullKeys(PREFIX);
    redis.disconnect();
  });

  it('a worker processes jobs of its active queue', async () => {
    const id = await enqueue('probe-critical');

    const { job, state } = await settled(id);

    expect(state).toBe('completed');
    expect(job.returnvalue).toEqual({ processedBy: 'probe-critical' });
  });

  // The desired behaviour, which the stock strategy does not have (ADR 0013, Addendum 2026-11-07): it stays
  // `it.fails` so that an upstream fix shows up as a failing test.
  it.fails('a worker leaves jobs of inactive queues for another pool', async () => {
    const id = await enqueue('probe-bulk');

    await sleep(UNTOUCHED_FOR_MS);

    expect(await bullQueue.getJobState(id)).toBe('waiting');
  });

  it('known limitation: stock BullMQ strategy fails jobs of inactive queues', async () => {
    const id = await enqueue('probe-bulk');

    const { job, state } = await settled(id);

    expect(state).toBe('failed');
    expect(job.failedReason).toBe('No processor defined for the queue "probe-bulk"');
  });
});
