import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { CORE_ID_COLUMN } from './core-id.column';

/**
 * The `catalog_product_collection` row: a Vendure product of a store linked to a collection of the same store channel
 * (Task 11 deviation: Vendure keeps collection members through filters, which P2.S3 owns). A join table, so the list
 * can filter by collection. Link ids are snowflakes made in order, so they keep the given order.
 */
@Entity('catalog_product_collection')
@Index(['businessId', 'productId', 'collectionId'], { unique: true })
@Index(['businessId', 'storeId', 'collectionId'])
export class ProductCollectionEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  productId!: string;

  @Column(CORE_ID_COLUMN)
  collectionId!: string;
}
