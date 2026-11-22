import { TenantEntity } from '@cod/plugin-tenancy';
import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { FeeGroupEntity } from './fee-group.entity';
import { PROVINCE_CODE_LENGTH, STORE_REQUIRED_CHECK } from './store-required';

/**
 * The `delivery_fee_rate` row: one wilaya of a fee group (D3107, D3120), whole DZD. Bases are the platform default
 * or a carrier sync, overrides the merchant's (`null` = none). Its group is referenced by `(businessId, storeId,
 * groupId)`, so a row can never hang off another store's group, and goes with it on delete.
 */
@Entity('delivery_fee_rate')
@Check('CHK_delivery_fee_rate_store', STORE_REQUIRED_CHECK)
export class FeeRateEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  groupId!: string;

  @PrimaryColumn({ type: 'varchar', length: PROVINCE_CODE_LENGTH })
  provinceCode!: string;

  @Column({ type: 'integer' })
  baseHome!: number;

  @Column({ type: 'integer' })
  baseDesk!: number;

  @Column({ type: 'integer', nullable: true })
  overrideHome!: number | null;

  @Column({ type: 'integer', nullable: true })
  overrideDesk!: number | null;

  @Column({ type: 'boolean' })
  deliveryEnabled!: boolean;

  @Column({ type: 'boolean' })
  deskEnabled!: boolean;

  @ManyToOne(() => FeeGroupEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    { name: 'businessId', referencedColumnName: 'businessId' },
    { name: 'storeId', referencedColumnName: 'storeId' },
    { name: 'groupId', referencedColumnName: 'id' },
  ])
  group?: FeeGroupEntity;
}
