import { TenantEntity } from '@cod/plugin-tenancy';
import { FEE_GROUP_NAME_MAX } from '@cod/shared';
import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { STORE_REQUIRED_CHECK } from './store-required';

/**
 * The `delivery_fee_group` row: one pricing option of one store (D3125). `storeId` is required by a check (TypeORM
 * keeps the base class's nullable column), `(businessId, storeId, id)` is unique so the rate rows reference their
 * group with the whole scope, and a store holds at most one platform default group (partial unique index).
 */
@Entity('delivery_fee_group')
@Check('CHK_delivery_fee_group_store', STORE_REQUIRED_CHECK)
@Index(['businessId', 'storeId', 'id'], { unique: true })
@Index(['businessId', 'storeId', 'createdAt'])
@Index(['businessId', 'storeId'], { unique: true, where: '"isPlatformDefault"' })
export class FeeGroupEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: FEE_GROUP_NAME_MAX })
  name!: string;

  /** Always null until carriers exist (P5.S1, D3109). */
  @Column({ type: 'bigint', nullable: true })
  carrierId!: string | null;

  @Column({ type: 'boolean' })
  chargeOverweight!: boolean;

  @Column({ type: 'integer' })
  overweightAllowanceKg!: number;

  /** Whole DZD per started kg above the allowance (D3121). */
  @Column({ type: 'integer' })
  overweightRate!: number;

  @Column({ type: 'boolean' })
  isPlatformDefault!: boolean;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
