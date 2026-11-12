import { QUEUES, type QueueName } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@vendure/core';
import type { Queue } from 'bullmq';
import { type JobPresence, type JobPresencePort, presenceOf } from '../domain/job-presence.port';
import { PooledJobQueueStrategy } from './pooled-job-queue.strategy';

const DELAYED_SCORE_FACTOR = 0x1000;

/** Job presence read from the BullMQ queue of the job's pool (D105). Needs the pooled strategy. */
@Injectable()
export class BullMqJobPresence implements JobPresencePort {
  constructor(private readonly config: ConfigService) {}

  async stateOf(queue: QueueName, jobId: string): Promise<JobPresence> {
    const job = await this.bullQueueOf(queue).getJob(jobId);
    if (job === undefined) return 'missing';
    return presenceOf(await job.getState());
  }

  async dueAtOf(queue: QueueName, jobId: string): Promise<Date | null> {
    const bull = this.bullQueueOf(queue);
    const score = await (await bull.client).zscore(bull.toKey('delayed'), jobId);
    if (score === null) return null;
    // BullMQ packs the due time (ms) above 12 bits of a counter that keeps equal times in order.
    return new Date(Math.floor(Number(score) / DELAYED_SCORE_FACTOR));
  }

  async remove(queue: QueueName, jobId: string): Promise<void> {
    await this.bullQueueOf(queue).remove(jobId);
  }

  private bullQueueOf(queue: QueueName): Queue {
    const strategy = this.config.jobQueueOptions.jobQueueStrategy;
    if (!(strategy instanceof PooledJobQueueStrategy)) {
      throw new Error('Job presence needs the pooled job queue strategy (PlatformJobsPlugin with pooledQueues)');
    }
    return strategy.bullQueueOf(QUEUES[queue].pool);
  }
}
