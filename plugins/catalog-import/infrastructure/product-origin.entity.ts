import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { JOB_WORD_MAX_LENGTH } from '../domain/constants';

/**
 * Where a store's product came from (D2210, D2214): `manual`, `import` or `link`, the import job, and the image links
 * a link import found (stored only, never rendered in P2.S2; assets come with P9.S7b).
 */
@Entity('catalog_product_origin')
@Index(['businessId', 'storeId', 'productId'], { unique: true })
export class ProductOriginEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'integer' })
  productId!: number;

  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH })
  source!: string;

  @Column({ type: 'bigint', nullable: true })
  importJobId!: string | null;

  @Column({ type: 'boolean', default: false })
  needsImageReview!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  imageUrls!: unknown;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
