import { Logger, PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';
import { JOB_PRESENCE } from './application/tokens';
import { CircuitBreaker } from './domain/breaker';
import { PLATFORM_CLOCK, type PlatformClock, SYSTEM_CLOCK } from './domain/clock.port';
import { CLEAN_JOB_QUEUE_INDEX_TASK_ID } from './domain/constants';
import { BusinessSemaphore } from './domain/semaphore';
import { BullMqJobPresence } from './infrastructure/bullmq-job-presence';
import { cleanPoolIndexesTask } from './infrastructure/clean-pool-indexes.task';
import { PooledJobQueueStrategy } from './infrastructure/pooled-job-queue.strategy';
import { createPlatformRedis, PlatformValkey } from './infrastructure/valkey-client';
import { ValkeyBusinessSemaphore } from './infrastructure/valkey-business-semaphore';
import { ValkeyCircuitBreaker } from './infrastructure/valkey-circuit-breaker';

/** How {@link PlatformJobsPlugin} is configured. */
export interface PlatformJobsPluginOptions {
  readonly redisUrl: string;
  /** `APP_ENV`; the pools' BullMQ prefixes are `bull:{appEnv}:{pool}`, and it starts every semaphore and breaker key. */
  readonly appEnv: string;
  /** BullMQ options of the pools. Absent: the stock strategy of `BullMQJobQueuePlugin` stays (tests only). */
  readonly pooledQueues?: BullMQPluginOptions;
}

/**
 * Installs the pooled strategy and the index task of every pool in place of the stock ones that
 * `BullMQJobQueuePlugin` set, which is why this plugin is listed after it (D97).
 */
export function configurePlatformJobs(
  config: RuntimeVendureConfig,
  options: PlatformJobsPluginOptions | undefined,
): RuntimeVendureConfig {
  if (options?.pooledQueues === undefined) return config;
  config.jobQueueOptions.jobQueueStrategy = new PooledJobQueueStrategy({
    appEnv: options.appEnv,
    bullMq: options.pooledQueues,
  });
  config.schedulerOptions.tasks = [
    ...config.schedulerOptions.tasks.filter((task) => task.id !== CLEAN_JOB_QUEUE_INDEX_TASK_ID),
    cleanPoolIndexesTask,
  ];
  return config;
}

const LOG_CONTEXT = 'PlatformJobsPlugin';

function requireOptions(): PlatformJobsPluginOptions {
  const { options } = PlatformJobsPlugin;
  if (options === undefined) {
    throw new Error('PlatformJobsPlugin is registered without options: use PlatformJobsPlugin.init(...)');
  }
  return options;
}

/** The Valkey client of the semaphore and the breaker, with its outage guard (D100). */
function createPlatformValkey(clock: PlatformClock): PlatformValkey {
  return new PlatformValkey(createPlatformRedis(requireOptions().redisUrl), {
    clock,
    logger: {
      error: (message) => {
        Logger.error(message, LOG_CONTEXT);
      },
    },
  });
}

/**
 * Queue pools on BullMQ (`WORKER_POOL`), job options from the queue registry, job presence (D96-D99), the business
 * semaphore and the circuit breaker (D100).
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => configurePlatformJobs(config, PlatformJobsPlugin.options),
  providers: [
    { provide: JOB_PRESENCE, useClass: BullMqJobPresence },
    { provide: PLATFORM_CLOCK, useValue: SYSTEM_CLOCK },
    { provide: PlatformValkey, useFactory: createPlatformValkey, inject: [PLATFORM_CLOCK] },
    {
      provide: BusinessSemaphore,
      useFactory: (valkey: PlatformValkey, clock: PlatformClock) =>
        new ValkeyBusinessSemaphore(valkey, { appEnv: requireOptions().appEnv, clock }),
      inject: [PlatformValkey, PLATFORM_CLOCK],
    },
    {
      provide: CircuitBreaker,
      useFactory: (valkey: PlatformValkey, clock: PlatformClock) =>
        new ValkeyCircuitBreaker(valkey, { appEnv: requireOptions().appEnv, clock }),
      inject: [PlatformValkey, PLATFORM_CLOCK],
    },
  ],
  exports: [JOB_PRESENCE, PLATFORM_CLOCK, BusinessSemaphore, CircuitBreaker],
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PlatformJobsPlugin {
  static options: PlatformJobsPluginOptions | undefined;

  /** Registers the plugin with its options. */
  static init(options: PlatformJobsPluginOptions): typeof PlatformJobsPlugin {
    PlatformJobsPlugin.options = options;
    return PlatformJobsPlugin;
  }

  /** True when the plugin will install {@link PooledJobQueueStrategy} (the boot assertion of ADR 0013 reads it). */
  static usesPooledQueues(): boolean {
    return PlatformJobsPlugin.options?.pooledQueues !== undefined;
  }
}
