import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { CORE_ID_COLUMN } from './core-id.column';

/**
 * The `catalog_product_tag` row: a tag on a Vendure product of the same store. A join table, because a `list` custom
 * field is JSON and cannot be filtered (D2100). Link ids are snowflakes made in order, so they keep the given order.
 */
@Entity('catalog_product_tag')
@Index(['businessId', 'productId', 'tagId'], { unique: true })
@Index(['businessId', 'storeId', 'tagId'])
export class ProductTagEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  productId!: string;

  @Column({ type: 'bigint' })
  tagId!: string;
}
