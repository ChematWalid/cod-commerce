import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { CONTENT_TYPE_MAX_LENGTH, EVENT_KEY_MAX_LENGTH, INBOUND_LAST_ERROR_MAX_LENGTH } from '../domain/constants';
import type { InboundStatus } from '../domain/inbound-webhook-handler';

/** One stored webhook (D106, D109). The table is partitioned by day, so the primary key holds `receivedAt`. */
// A partitioned table: the migration and `INBOUND_WEBHOOK_SCHEMAS` create it, never `synchronize`.
@Entity({ name: 'inbound_webhook', synchronize: false })
@Index('IDX_inbound_webhook_received', ['receivedAt'], { where: `"status" = 'received'` })
export class InboundWebhookEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @PrimaryColumn({ type: 'timestamptz' })
  receivedAt!: Date;

  @Column({ type: 'varchar', length: 40 })
  provider!: string;

  @Column({ type: 'varchar', length: 64 })
  accountId!: string;

  @Column({ type: 'varchar', length: EVENT_KEY_MAX_LENGTH })
  eventKey!: string;

  @Column({ type: 'varchar', length: CONTENT_TYPE_MAX_LENGTH })
  contentType!: string;

  @Column({ type: 'jsonb' })
  headers!: Record<string, string>;

  /** The exact body; cleared after 14 days. */
  @Column({ type: 'bytea', nullable: true })
  payload!: Buffer | null;

  @Column({ type: 'varchar', length: 16, default: 'received' })
  status!: InboundStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'varchar', length: INBOUND_LAST_ERROR_MAX_LENGTH, nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
