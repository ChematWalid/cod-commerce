import { TenantEntity } from '@cod/plugin-tenancy';
import { PACK_SHARED_OPTION_MAX } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { PACK_KIND_MAX_LENGTH } from '../domain/constants';

/** The `catalog_pack` row: one pack per pack product of a store (D2202); modes as their words, amounts in DZD/grams. */
@Entity('catalog_pack')
@Index(['businessId', 'storeId', 'productId'], { unique: true })
export class PackEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  /** The Vendure product id of the pack product. */
  @Column({ type: 'integer' })
  productId!: number;

  @Column({ type: 'varchar', length: PACK_KIND_MAX_LENGTH })
  status!: string;

  @Column({ type: 'varchar', length: PACK_KIND_MAX_LENGTH })
  pricingMode!: string;

  @Column({ type: 'integer', nullable: true })
  fixedPrice!: number | null;

  @Column({ type: 'varchar', length: PACK_KIND_MAX_LENGTH, nullable: true })
  discountType!: string | null;

  @Column({ type: 'integer', nullable: true })
  discountValue!: number | null;

  @Column({ type: 'varchar', length: PACK_KIND_MAX_LENGTH })
  variantMode!: string;

  @Column({ type: 'varchar', length: PACK_SHARED_OPTION_MAX, nullable: true })
  sharedOption!: string | null;

  @Column({ type: 'varchar', length: PACK_KIND_MAX_LENGTH })
  weightMode!: string;

  @Column({ type: 'integer', nullable: true })
  fixedWeightGrams!: number | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
