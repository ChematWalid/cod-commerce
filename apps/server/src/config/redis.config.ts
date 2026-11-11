import { bullMqJobOptions } from '@cod/plugin-platform-jobs';
import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';
import type { AppEnv } from './env';
import { redisOptionsFromUrl } from './redis-url';

export { redisOptionsFromUrl };

/**
 * BullMQ options. Its blocking worker connections require `maxRetriesPerRequest: null`, and queue keys are
 * prefixed by `APP_ENV` so environments sharing a Valkey never consume each other's jobs (ADR 0013). The pooled
 * strategy appends the pool to the prefix (`bull:{APP_ENV}:{pool}`, D100); attempts, backoff, `jobId` and
 * `delay` come from the queue registry (D101).
 */
export function bullMqOptions(env: AppEnv): BullMQPluginOptions {
  const prefix = `bull:${env.APP_ENV}`;
  return {
    connection: { ...redisOptionsFromUrl(env.REDIS_URL), maxRetriesPerRequest: null },
    queueOptions: { prefix },
    workerOptions: { prefix },
    setJobOptions: bullMqJobOptions(),
  };
}
