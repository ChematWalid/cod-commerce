import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { OUTBOX_LAST_ERROR_MAX_LENGTH } from '../domain/constants';
import type { DeliveryStatus } from '../domain/delivery-status';

/** One consumer's share of an event (D105, D106). `createdAt` is the event's, so both tables prune the same way. */
// A partitioned table: the migration and `OUTBOX_SCHEMAS` create it, never `synchronize`.
@Entity({ name: 'outbox_delivery', synchronize: false })
@Index('IDX_outbox_delivery_open', ['createdAt'], { where: `"status" IN ('pending', 'enqueued')` })
export class OutboxDeliveryEntity extends TenantEntity {
  @PrimaryColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @PrimaryColumn({ type: 'bigint' })
  outboxId!: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  consumer!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: DeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  enqueuedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextAttemptAt!: Date | null;

  @Column({ type: 'varchar', length: OUTBOX_LAST_ERROR_MAX_LENGTH, nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
