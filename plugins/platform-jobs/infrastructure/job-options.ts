import { isQueueName, QUEUES } from '@cod/shared';
import type { Job } from '@vendure/core';
import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';

type SetJobOptions = NonNullable<BullMQPluginOptions['setJobOptions']>;
type BullJobOptions = ReturnType<SetJobOptions>;

/** The fields of a job's data that steer BullMQ: a durable id and a start delay (D99, `DurableJobData`). */
function durableOptionsOf(data: unknown): Pick<NonNullable<BullJobOptions>, 'jobId' | 'delay'> {
  if (typeof data !== 'object' || data === null) return {};
  const { jobId, delayMs } = data as { jobId?: unknown; delayMs?: unknown };
  return {
    ...(typeof jobId === 'string' ? { jobId } : {}),
    ...(Number.isInteger(delayMs) && (delayMs as number) >= 0 ? { delay: delayMs as number } : {}),
  };
}

/**
 * BullMQ's per-job options from the queue registry: total attempts and backoff of the job's queue, plus `jobId`
 * and `delay` from `data.jobId` (a string) and `data.delayMs` (a non-negative integer). A queue outside the
 * registry keeps the stock options; the pooled strategy refuses such a queue anyway (D97, D98).
 */
export function bullMqJobOptions(): SetJobOptions {
  return (queueName: string, job: Job): BullJobOptions => {
    if (!isQueueName(queueName)) return {};
    const { attempts, backoff } = QUEUES[queueName];
    return {
      attempts,
      backoff: { type: backoff.type, delay: backoff.delayMs },
      ...durableOptionsOf(job.data),
    };
  };
}
