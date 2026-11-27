import { PooledJobQueueStrategy } from '@cod/plugin-platform-jobs';
import type { QueuePool } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@vendure/core';
import type { Queue } from 'bullmq';
import type { QueueSnapshotPort } from '../application/ports';
import { QUEUE_JOB_STATES, QUEUE_SAMPLE_LIMIT, type QueueJobState } from '../domain/constants';
import type { QueuedJob, QueueSnapshot } from '../domain/queue-gauges';

/** The slice of a BullMQ queue the snapshot reads; `getJobs(…, asc = true)` lists the oldest first. */
export type SnapshotQueue = Pick<Queue, 'getJobCounts' | 'getJobs'>;

/** Reads a pool's counts and a bounded, oldest-first sample of its jobs. */
export async function snapshotOfQueue(queue: SnapshotQueue): Promise<QueueSnapshot> {
  const counts = await queue.getJobCounts(...QUEUE_JOB_STATES);
  const samples = await Promise.all(
    QUEUE_JOB_STATES.map(async (state): Promise<QueuedJob[]> => {
      const jobs = await queue.getJobs([state], 0, QUEUE_SAMPLE_LIMIT - 1, true);
      return jobs.map((job) => ({ name: job.name, state, enqueuedAtMs: job.timestamp }));
    }),
  );
  const countOf = (state: QueueJobState): number => counts[state] ?? 0;
  return {
    counts: {
      waiting: countOf('waiting'),
      active: countOf('active'),
      failed: countOf('failed'),
      delayed: countOf('delayed'),
    },
    jobs: samples.flat(),
  };
}

/** The pool queues of the pooled strategy (D100): `bull:{APP_ENV}:{pool}`, one BullMQ queue per pool. */
@Injectable()
export class BullMqQueueSnapshot implements QueueSnapshotPort {
  constructor(private readonly config: ConfigService) {}

  /** @throws Error when the pooled strategy is not installed: the gauges would read the wrong keys. */
  async snapshotOf(pool: QueuePool): Promise<QueueSnapshot> {
    const strategy = this.config.jobQueueOptions.jobQueueStrategy;
    if (!(strategy instanceof PooledJobQueueStrategy)) {
      throw new Error('Queue gauges need the pooled job queue strategy (PlatformJobsPlugin with pooledQueues)');
    }
    return snapshotOfQueue(strategy.bullQueueOf(pool));
  }
}
