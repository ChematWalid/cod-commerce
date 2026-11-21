import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { CORE_ID_COLUMN } from './core-id.column';

/**
 * The `catalog_media` row: an asset of the business's media library and the store that uploaded it (D2113, D2132).
 * One row per asset.
 */
@Entity('catalog_media')
@Index(['businessId', 'assetId'], { unique: true })
@Index(['businessId', 'storeId', 'createdAt', 'id'])
export class MediaEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  assetId!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
