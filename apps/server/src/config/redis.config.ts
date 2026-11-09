import { AUTH_EMAIL_QUEUE } from '@cod/plugin-auth';
import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';
import type { AppEnv } from './env';
import { redisOptionsFromUrl } from './redis-url';

export { redisOptionsFromUrl };

/**
 * The wait before the first retry of an account email; it doubles each time, so five attempts span about eight
 * minutes, long enough to outlast a mail server restart (BullMQ's default of 1 s would burn them in 15 s).
 */
export const AUTH_EMAIL_BACKOFF_DELAY_MS = 30_000;

/** BullMQ's per-queue job options: the account email queue backs off; the others keep the default. */
export function authEmailJobOptions(
  delay: number = AUTH_EMAIL_BACKOFF_DELAY_MS,
): NonNullable<BullMQPluginOptions['setJobOptions']> {
  return (queueName) => (queueName === AUTH_EMAIL_QUEUE ? { backoff: { type: 'exponential', delay } } : {});
}

/**
 * BullMQ options. Its blocking worker connections require `maxRetriesPerRequest: null`, and queue keys are
 * prefixed by `APP_ENV` so environments sharing a Valkey never consume each other's jobs (ADR 0013).
 */
export function bullMqOptions(env: AppEnv): BullMQPluginOptions {
  const prefix = `bull:${env.APP_ENV}`;
  return {
    connection: { ...redisOptionsFromUrl(env.REDIS_URL), maxRetriesPerRequest: null },
    queueOptions: { prefix },
    workerOptions: { prefix },
    setJobOptions: authEmailJobOptions(),
  };
}
