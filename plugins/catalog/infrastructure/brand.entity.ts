import { TenantEntity } from '@cod/plugin-tenancy';
import { BRAND_NAME_MAX } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BRAND_NAME_KEY_MAX } from '../domain/constants';

/** The `catalog_brand` row: one name per store, compared by its stored key, never an expression index (D2140). */
@Entity('catalog_brand')
@Index(['businessId', 'storeId', 'nameKey'], { unique: true })
@Index(['businessId', 'storeId', 'createdAt', 'id'])
export class BrandEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: BRAND_NAME_MAX })
  name!: string;

  @Column({ type: 'varchar', length: BRAND_NAME_KEY_MAX })
  nameKey!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
