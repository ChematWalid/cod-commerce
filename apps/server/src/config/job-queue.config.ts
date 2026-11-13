import { PlatformJobsPlugin, PooledJobQueueStrategy } from '@cod/plugin-platform-jobs';
import { activeQueuesFor } from '@cod/shared';
import type { JobQueueOptions, VendureConfig } from '@vendure/core';
import type { AppEnv, ServerRole } from './env';

/** Only the worker consumes jobs, so only it narrows the queues, to those of its pool (`all`: every queue). */
export function buildJobQueueConfig(env: AppEnv, role: ServerRole): JobQueueOptions {
  if (role !== 'worker') {
    return {};
  }
  return { activeQueues: [...activeQueuesFor(env.WORKER_POOL)] };
}

/** The configured strategy, or the one `PlatformJobsPlugin` will install at bootstrap. */
function isPooled(config: VendureConfig): boolean {
  const strategy = config.jobQueueOptions?.jobQueueStrategy;
  if (strategy !== undefined) {
    return strategy instanceof PooledJobQueueStrategy;
  }
  return (config.plugins ?? []).includes(PlatformJobsPlugin) && PlatformJobsPlugin.usesPooledQueues();
}

/**
 * Boot assertion of ADR 0013 (addendum, item 3): `activeQueues` is set only with the pooled strategy. With the
 * stock BullMQ strategy a worker fails every job of a queue it does not run instead of leaving it waiting.
 *
 * @throws Error naming the strategy when the assertion fails.
 */
export function assertPooledJobQueue(config: VendureConfig): void {
  if ((config.jobQueueOptions?.activeQueues ?? []).length === 0 || isPooled(config)) {
    return;
  }
  throw new Error(
    'jobQueueOptions.activeQueues is set but the job queue strategy is not PooledJobQueueStrategy: jobs of the ' +
      'other queues would fail (ADR 0013). Register PlatformJobsPlugin with pooledQueues, or use WORKER_POOL=all.',
  );
}
