import { PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import type { BullMQPluginOptions } from '@vendure/job-queue-plugin/package/bullmq';
import { JOB_PRESENCE } from './application/tokens';
import { CLEAN_JOB_QUEUE_INDEX_TASK_ID } from './domain/constants';
import { BullMqJobPresence } from './infrastructure/bullmq-job-presence';
import { cleanPoolIndexesTask } from './infrastructure/clean-pool-indexes.task';
import { PooledJobQueueStrategy } from './infrastructure/pooled-job-queue.strategy';

/** How {@link PlatformJobsPlugin} is configured. */
export interface PlatformJobsPluginOptions {
  readonly redisUrl: string;
  /** `APP_ENV`; the pools' BullMQ prefixes are `bull:{appEnv}:{pool}`. */
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

/** Queue pools on BullMQ (`WORKER_POOL`), job options from the queue registry and job presence (D96-D99). */
@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => configurePlatformJobs(config, PlatformJobsPlugin.options),
  providers: [{ provide: JOB_PRESENCE, useClass: BullMqJobPresence }],
  exports: [JOB_PRESENCE],
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
