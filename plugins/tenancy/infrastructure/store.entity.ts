import { SUBDOMAIN_MAX_LENGTH } from '@cod/shared';
import { Check, Column, Entity, PrimaryColumn } from 'typeorm';
import { LANGUAGE_CODE_MAX_LENGTH, NAME_MAX_LENGTH, STATE_COLUMN_MAX_LENGTH } from '../domain/constants';
import type { SoldOutBehavior, StoreStatus } from '../domain/store';
import { TenantEntity } from './tenant.entity';

/** The `store` row, one per Vendure channel. D3: the check gives `citext`'s guarantee without the extension. */
@Entity('store')
@Check('store_subdomain_lowercase', '"subdomain" = lower("subdomain")')
export class StoreEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'int', unique: true })
  channelId!: number;

  @Column({ type: 'int' })
  sellerId!: number;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'int', nullable: true })
  logoAssetId!: number | null;

  @Column({ type: 'varchar', length: LANGUAGE_CODE_MAX_LENGTH })
  language!: string;

  @Column({ type: 'varchar', length: SUBDOMAIN_MAX_LENGTH, unique: true })
  subdomain!: string;

  @Column({ type: 'bigint', nullable: true })
  defaultDeliveryFeeGroupId!: string | null;

  @Column({ type: 'bigint', nullable: true })
  defaultCarrierId!: string | null;

  @Column({ type: 'boolean', default: true })
  showAddressField!: boolean;

  @Column({ type: 'varchar', length: STATE_COLUMN_MAX_LENGTH, default: 'keep' })
  soldOutBehavior!: SoldOutBehavior;

  @Column({ type: 'varchar', length: STATE_COLUMN_MAX_LENGTH })
  status!: StoreStatus;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
