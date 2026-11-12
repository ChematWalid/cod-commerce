import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { EVENT_KEY_MAX_LENGTH } from '../domain/constants';

/**
 * The dedupe triple of every webhook ever accepted in the last 30 days (D108). A platform table: it holds no tenant
 * data, and its primary key is exactly the triple, so a repeat conflicts whichever day it arrives.
 */
@Entity({ name: 'inbound_webhook_key' })
export class InboundWebhookKeyEntity {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  provider!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  accountId!: string;

  @PrimaryColumn({ type: 'varchar', length: EVENT_KEY_MAX_LENGTH })
  eventKey!: string;

  @Index('IDX_inbound_webhook_key_received')
  @Column({ type: 'timestamptz' })
  receivedAt!: Date;
}
