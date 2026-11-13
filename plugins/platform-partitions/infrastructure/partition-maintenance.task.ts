import { catchUpTask } from '@cod/plugin-platform-jobs';
import { PartitionMaintenanceService } from '../application/partition-maintenance.service';
import {
  PARTITION_MAINTENANCE_SCHEDULE,
  PARTITION_MAINTENANCE_TASK_ID,
  PARTITION_MAINTENANCE_TIMEOUT_MS,
} from '../domain/constants';

/** Daily at 02:00 UTC: makes the next partitions and drops, keeps or scrubs the old ones as of the platform clock. */
export const partitionMaintenanceTask = catchUpTask({
  id: PARTITION_MAINTENANCE_TASK_ID,
  schedule: PARTITION_MAINTENANCE_SCHEDULE,
  description: 'Creates the next partitions of every partitioned table and drops, keeps or scrubs the old ones',
  timeoutMs: PARTITION_MAINTENANCE_TIMEOUT_MS,
  async run(injector, now) {
    const report = await injector.get(PartitionMaintenanceService).maintain(now);
    return {
      created: report.created.length,
      dropped: report.dropped.length,
      kept: report.kept.length,
      scrubbed: report.scrubbed.length,
    };
  },
});
