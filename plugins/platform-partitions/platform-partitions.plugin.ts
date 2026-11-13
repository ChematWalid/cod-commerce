import { Inject } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PartitionMaintenanceService } from './application/partition-maintenance.service';
import { PartitionRegistry } from './application/partition-registry';
import { PARTITION_CATALOG, PARTITION_LOGGER } from './application/tokens';
import { PARTITION_MAINTENANCE_TASK_ID, PARTITIONS_LOG_CONTEXT } from './domain/constants';
import type { PartitionCatalog, PartitionLogger } from './domain/partition-catalog.port';
import { partitionMaintenanceTask } from './infrastructure/partition-maintenance.task';
import { PostgresPartitionCatalog } from './infrastructure/postgres-partition-catalog';

const partitionLogger: PartitionLogger = {
  error: (message) => {
    Logger.error(message, PARTITIONS_LOG_CONTEXT);
  },
};

/**
 * Native range-partition maintenance (D106): owning plugins register a policy per table in `onModuleInit`; the
 * `partition-maintenance` task and the migrate role then make the next partitions and drop, keep or scrub the old ones.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  configuration: (config) => {
    config.schedulerOptions.tasks = [
      ...config.schedulerOptions.tasks.filter((task) => task.id !== PARTITION_MAINTENANCE_TASK_ID),
      partitionMaintenanceTask,
    ];
    return config;
  },
  providers: [
    { provide: PartitionRegistry, useFactory: () => new PartitionRegistry() },
    { provide: PARTITION_CATALOG, useClass: PostgresPartitionCatalog },
    { provide: PARTITION_LOGGER, useValue: partitionLogger },
    {
      provide: PartitionMaintenanceService,
      useFactory: (registry: PartitionRegistry, catalog: PartitionCatalog, logger: PartitionLogger) =>
        new PartitionMaintenanceService(registry, catalog, logger),
      inject: [PartitionRegistry, PARTITION_CATALOG, PARTITION_LOGGER],
    },
  ],
  exports: [PartitionRegistry, PartitionMaintenanceService],
  compatibility: '^3.8.0',
})
export class PlatformPartitionsPlugin {
  constructor(@Inject(PartitionRegistry) private readonly registry: PartitionRegistry) {}

  /** Every plugin has registered its tables in `onModuleInit` by now. */
  onApplicationBootstrap(): void {
    this.registry.close();
  }
}
