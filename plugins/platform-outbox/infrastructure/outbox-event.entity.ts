import { TenantEntity } from '@cod/plugin-tenancy';
import type { OutboxPayload } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { OUTBOX_DEDUPE_KEY_MAX_LENGTH } from '../domain/constants';
import type { EventStatus } from '../domain/delivery-status';

/** One announced fact (D104, D106). The table is partitioned by day, so the primary key holds `createdAt`. */
// A partitioned table: the migration and `OUTBOX_SCHEMAS` create it, never `synchronize`.
@Entity({ name: 'outbox_event', synchronize: false })
@Index('IDX_outbox_event_pending', ['createdAt'], { where: `"status" = 'pending'` })
export class OutboxEventEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @PrimaryColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 64 })
  topic!: string;

  @Column({ type: 'bigint', nullable: true })
  aggregateId!: string | null;

  @Column({ type: 'jsonb' })
  payload!: OutboxPayload;

  @Column({ type: 'varchar', length: OUTBOX_DEDUPE_KEY_MAX_LENGTH, nullable: true })
  dedupeKey!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: EventStatus;

  @Column({ type: 'timestamptz', nullable: true })
  relayedAt!: Date | null;
}
