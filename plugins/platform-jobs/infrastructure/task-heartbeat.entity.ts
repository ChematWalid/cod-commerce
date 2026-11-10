import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TASK_ID_MAX_LENGTH } from '../domain/constants';

/**
 * When a scheduled task last finished a run without error (D117). A platform table, one row per task, so it is
 * deliberately not a `TenantEntity` (D105).
 */
@Entity('platform_task_heartbeat')
export class TaskHeartbeatEntity {
  @PrimaryColumn({ type: 'varchar', length: TASK_ID_MAX_LENGTH })
  taskId!: string;

  @Column({ type: 'timestamptz' })
  lastSuccessAt!: Date;
}
