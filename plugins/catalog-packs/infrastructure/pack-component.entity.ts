import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * The `catalog_pack_component` row: one component line of a pack, in `position` order. Indexed by component
 * product, so a `product.changed` finds the packs holding it (D2203).
 */
@Entity('catalog_pack_component')
@Index(['businessId', 'storeId', 'productId'])
@Index(['businessId', 'packId'])
export class PackComponentEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  packId!: string;

  @Column({ type: 'integer' })
  position!: number;

  /** The Vendure product id of the component. */
  @Column({ type: 'integer' })
  productId!: number;

  /** The pinned Vendure variant id, or none (the buyer picks, D2202). */
  @Column({ type: 'integer', nullable: true })
  variantId!: number | null;

  @Column({ type: 'integer' })
  quantity!: number;
}
