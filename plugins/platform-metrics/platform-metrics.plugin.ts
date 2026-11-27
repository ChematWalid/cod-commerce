import { PLATFORM_CLOCK, type PlatformClock, PlatformJobsPlugin, TaskHeartbeatReader } from '@cod/plugin-platform-jobs';
import { OUTBOX_DUE_SCAN, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { QUEUE_POOLS } from '@cod/shared';
import { Inject, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PlatformGaugesService } from './application/platform-gauges.service';
import type { OutboxBacklogPort, QueueSnapshotPort, TaskSuccessPort } from './application/ports';
import { METRICS_LOG_CONTEXT } from './domain/constants';
import { BullMqQueueSnapshot } from './infrastructure/bullmq-queue-snapshot';
import { OtelGaugeExporter } from './infrastructure/otel-gauge-exporter';

const metricsLogger = {
  error: (message: string): void => {
    Logger.error(message, METRICS_LOG_CONTEXT);
  },
};

const TASK_SUCCESS = Symbol('PlatformMetricsTaskSuccess');

const createTaskSuccess = (heartbeats: TaskHeartbeatReader, config: ConfigService): TaskSuccessPort => ({
  lastSuccess: () => heartbeats.lastSuccess(),
  scheduledTaskIds: () => config.schedulerOptions.tasks.map((task) => task.id),
});

const createGauges = (
  queues: QueueSnapshotPort,
  outbox: OutboxBacklogPort,
  tasks: TaskSuccessPort,
  clock: PlatformClock,
): PlatformGaugesService =>
  new PlatformGaugesService({
    queues,
    pools: QUEUE_POOLS,
    outbox,
    tasks,
    now: () => clock.now(),
    logger: metricsLogger,
  });

/**
 * The platform gauges of ADR 0015 that no request emits (outbox backlog, scheduler heartbeats, queue depth per
 * pool and job name), on the OpenTelemetry meter. The server registers it on the worker only: the values are
 * platform-wide, so one role reports them. It declares no entity.
 */
@VendurePlugin({
  imports: [PluginCommonModule, PlatformJobsPlugin, PlatformOutboxPlugin],
  providers: [
    BullMqQueueSnapshot,
    { provide: TASK_SUCCESS, useFactory: createTaskSuccess, inject: [TaskHeartbeatReader, ConfigService] },
    {
      provide: PlatformGaugesService,
      useFactory: createGauges,
      inject: [BullMqQueueSnapshot, OUTBOX_DUE_SCAN, TASK_SUCCESS, PLATFORM_CLOCK],
    },
    {
      provide: OtelGaugeExporter,
      useFactory: (gauges: PlatformGaugesService) => new OtelGaugeExporter(gauges),
      inject: [PlatformGaugesService],
    },
  ],
  compatibility: '^3.8.0',
})
export class PlatformMetricsPlugin implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(@Inject(OtelGaugeExporter) private readonly exporter: OtelGaugeExporter) {}

  onApplicationBootstrap(): void {
    this.exporter.start();
  }

  onApplicationShutdown(): void {
    this.exporter.stop();
  }
}
