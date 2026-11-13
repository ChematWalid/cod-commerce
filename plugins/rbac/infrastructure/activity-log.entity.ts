import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import {
  ACTIVITY_ACTION_MAX_LENGTH,
  ACTIVITY_ENTITY_ID_MAX_LENGTH,
  ACTIVITY_ENTITY_TYPE_MAX_LENGTH,
  ACTIVITY_IP_MAX_LENGTH,
  ACTIVITY_SUMMARY_MAX_LENGTH,
  ACTIVITY_USER_AGENT_MAX_LENGTH,
} from '../domain/constants';

/** One recorded action. Snowflake ids are time-ordered, so `id` is both the sort and the cursor (D65). */
// A partitioned table (D123): the migration and `ACTIVITY_LOG_SCHEMA` create it, never `synchronize`.
@Entity({ name: 'activity_log', synchronize: false })
@Index(['businessId', 'id'])
@Index(['businessId', 'actorAdministratorId', 'id'])
@Index(['businessId', 'action', 'id'])
export class ActivityLogEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'int', nullable: true })
  actorAdministratorId!: number | null;

  @Column({ type: 'varchar', length: ACTIVITY_ACTION_MAX_LENGTH })
  action!: string;

  @Column({ type: 'varchar', length: ACTIVITY_ENTITY_TYPE_MAX_LENGTH })
  entityType!: string;

  @Column({ type: 'varchar', length: ACTIVITY_ENTITY_ID_MAX_LENGTH })
  entityId!: string;

  @Column({ type: 'varchar', length: ACTIVITY_SUMMARY_MAX_LENGTH })
  summary!: string;

  @Column({ type: 'jsonb' })
  diff!: Record<string, unknown>;

  @Column({ type: 'varchar', length: ACTIVITY_IP_MAX_LENGTH, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: ACTIVITY_USER_AGENT_MAX_LENGTH, nullable: true })
  userAgent!: string | null;

  @PrimaryColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
