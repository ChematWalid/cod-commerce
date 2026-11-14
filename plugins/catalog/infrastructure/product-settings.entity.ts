import { TenantEntity } from '@cod/plugin-tenancy';
import { NAME_IN_DELIVERY_MAX } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { CustomAttribute } from '../domain/product-settings';
import { CORE_ID_COLUMN } from './core-id.column';

/** The `catalog_product_settings` row: the merchant-only settings of one product of a store (AC5, D2107, D2108). */
@Entity('catalog_product_settings')
@Index(['businessId', 'storeId', 'productId'], { unique: true })
export class ProductSettingsEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  productId!: string;

  @Column({ type: 'varchar', length: NAME_IN_DELIVERY_MAX, nullable: true })
  nameInDelivery!: string | null;

  @Column({ type: 'boolean' })
  isFragile!: boolean;

  @Column({ type: 'boolean' })
  allowParcelOpening!: boolean;

  @Column({ type: 'boolean' })
  allowOutOfStockOrders!: boolean;

  @Column({ type: 'boolean' })
  soldOut!: boolean;

  @Column({ type: 'boolean' })
  quantityRulesEnabled!: boolean;

  @Column({ type: 'int' })
  quantityMin!: number;

  @Column({ type: 'int' })
  quantityStep!: number;

  @Column({ type: 'bigint', array: true })
  orderManagerIds!: string[];

  @Column({ type: 'jsonb' })
  customAttributes!: CustomAttribute[];

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
