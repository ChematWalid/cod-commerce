import type { JobQueueOptions } from '@vendure/core';
import type { AppEnv, ServerRole } from './env';

/** Only the worker consumes jobs, so only it narrows the queues; an empty list means every queue. */
export function buildJobQueueConfig(env: AppEnv, role: ServerRole): JobQueueOptions {
  if (role !== 'worker' || env.WORKER_ACTIVE_QUEUES.length === 0) {
    return {};
  }
  return { activeQueues: env.WORKER_ACTIVE_QUEUES };
}
