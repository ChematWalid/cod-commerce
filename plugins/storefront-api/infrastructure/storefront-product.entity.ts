import { TenantEntity } from '@cod/plugin-tenancy';
import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { CORE_ID_COLUMN } from './core-id.column';

/** The table of the storefront projection (D3205). */
export const STOREFRONT_PRODUCT_TABLE = 'storefront_product';

/**
 * The `storefront_product` row: one product of a store as its lists, collection pages and search read it (D3205),
 * fed by `product.changed` and `store.changed` and rebuilt per store when empty. `listed` folds visibility and the
 * store's sold-out hiding, so a list never builds an exclusion list (#251). Index names are explicit, so the committed
 * migration and the entity agree without generated hashes.
 */
@Entity(STOREFRONT_PRODUCT_TABLE)
@Check('storefront_product_store_required', '"storeId" IS NOT NULL')
@Index('storefront_product_store_product', ['businessId', 'storeId', 'productId'], { unique: true })
@Index('storefront_product_store_slug', ['businessId', 'storeId', 'slug'], { unique: true })
@Index('storefront_product_listed_newest', ['businessId', 'storeId', 'listed', 'createdAt', 'productId'])
@Index('storefront_product_listed_price', ['businessId', 'storeId', 'listed', 'price', 'productId'])
export class StorefrontProductEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  productId!: string;

  @Column({ type: 'varchar', length: 255 })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  searchText!: string;

  /** Whole DZD (ADR 0004); at most `MONEY_MAX_DZD`, a Postgres `integer`. */
  @Column({ type: 'integer' })
  price!: number;

  @Column({ type: 'integer', nullable: true })
  oldPrice!: number | null;

  @Column({ type: 'text', nullable: true })
  imagePath!: string | null;

  @Column({ type: 'boolean' })
  visible!: boolean;

  @Column({ type: 'boolean' })
  soldOut!: boolean;

  @Column({ type: 'boolean' })
  listed!: boolean;

  /** When the product was created: the "newest" order. */
  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  /** When this row was last written. */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
