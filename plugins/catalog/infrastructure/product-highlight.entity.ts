import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { CORE_ID_COLUMN } from './core-id.column';

/** The `catalog_product_highlight` row: a highlight a product shows, at `position` in its list (at most six, AC3). */
@Entity('catalog_product_highlight')
@Index(['businessId', 'productId', 'highlightId'], { unique: true })
@Index(['businessId', 'storeId', 'highlightId'])
export class ProductHighlightEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  productId!: string;

  @Column({ type: 'bigint' })
  highlightId!: string;

  @Column({ type: 'int' })
  position!: number;
}
