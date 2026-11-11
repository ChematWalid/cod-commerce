import { DefaultLogger, LogLevel, type VendureConfig } from '@vendure/core';
import { buildAuthConfig } from './auth.config';
import { buildDbConfig } from './db.config';
import { DzdMoneyStrategy } from './dzd-money-strategy';
import type { AppEnv, LogLevelName, ServerRole } from './env';
import { assertPooledJobQueue, buildJobQueueConfig } from './job-queue.config';
import { buildPlugins } from './plugins.config';

const VENDURE_LOG_LEVELS: Record<LogLevelName, LogLevel> = {
  error: LogLevel.Error,
  warn: LogLevel.Warn,
  info: LogLevel.Info,
  verbose: LogLevel.Verbose,
  debug: LogLevel.Debug,
};

/**
 * The Vendure config of one server role. It only composes the per-concern builders. The built-in health
 * checks stay empty because `PlatformHealthPlugin` serves the probes (ADR 0013).
 *
 * @throws Error when `activeQueues` is set without the pooled job queue strategy (ADR 0013 addendum).
 */
export function buildVendureConfig(env: AppEnv, role: ServerRole): VendureConfig {
  const config: VendureConfig = {
    apiOptions: {
      port: env.API_PORT,
      trustProxy: env.TRUSTED_PROXY_HOPS,
      cors: { origin: env.CORS_ORIGINS, credentials: true },
    },
    authOptions: buildAuthConfig(env),
    // Payment handlers arrive with their plugins; Vendure requires the list.
    paymentOptions: { paymentMethodHandlers: [] },
    dbConnectionOptions: buildDbConfig(env, role),
    entityOptions: { moneyStrategy: new DzdMoneyStrategy() },
    jobQueueOptions: buildJobQueueConfig(env, role),
    systemOptions: { healthChecks: [] },
    logger: new DefaultLogger({ level: VENDURE_LOG_LEVELS[env.LOG_LEVEL] }),
    plugins: buildPlugins(env, role),
  };
  assertPooledJobQueue(config);
  return config;
}
