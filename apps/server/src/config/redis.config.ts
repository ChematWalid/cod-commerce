import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';
import type { RedisOptions } from 'ioredis';
import type { AppEnv } from './env';

const DEFAULT_REDIS_PORT = 6379;
const TLS_SCHEME = 'rediss:';

/**
 * The database index in a `redis://host:port/<db>` path, or undefined when the path names none.
 *
 * @throws {Error} when the path is not a database index.
 */
function databaseOf(pathname: string): number | undefined {
  const index = pathname.replace(/^\//, '');
  if (index === '') {
    return undefined;
  }
  const db = Number(index);
  if (!Number.isInteger(db) || db < 0) {
    throw new Error('REDIS_URL: the path must be a database index, e.g. redis://host:6379/0');
  }
  return db;
}

/** The `ioredis` options of a `redis://` or `rediss://` URL (validated by `loadEnv`). */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port === '' ? DEFAULT_REDIS_PORT : Number(parsed.port),
    username: parsed.username === '' ? undefined : decodeURIComponent(parsed.username),
    password: parsed.password === '' ? undefined : decodeURIComponent(parsed.password),
    db: databaseOf(parsed.pathname),
    tls: parsed.protocol === TLS_SCHEME ? {} : undefined,
  };
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
  };
}
