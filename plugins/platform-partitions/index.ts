export { PartitionMaintenanceService } from './application/partition-maintenance.service';
export { PartitionRegistry } from './application/partition-registry';
export {
  PARTITION_MAINTENANCE_SCHEDULE,
  PARTITION_MAINTENANCE_TASK_ID,
  PARTITION_MAINTENANCE_TIMEOUT_MS,
} from './domain/constants';
export {
  InvalidPartitionPolicyError,
  PartitionMaintenanceFailedError,
  PartitionRegistryClosedError,
  PartitionTableAlreadyRegisteredError,
} from './domain/errors';
export {
  expiredPartitions,
  partitionName,
  partitionRange,
  plannedPartitions,
  scrubbableByAge,
} from './domain/partition-calendar';
export type {
  PartitionInterval,
  PartitionMaintenanceReport,
  PartitionPolicy,
  PartitionRef,
  PartitionScrub,
} from './domain/policy';
export { type EntityMetadataLike, findUniqueIndexesWithoutPartitionKey } from './domain/unique-index-rule';
export { partitionMaintenanceTask } from './infrastructure/partition-maintenance.task';
export { PostgresPartitionCatalog } from './infrastructure/postgres-partition-catalog';
export { PlatformPartitionsPlugin } from './platform-partitions.plugin';
export type { PartitionedTableSchema } from '@cod/shared';
