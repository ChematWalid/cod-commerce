import { TenantEntity } from '@cod/plugin-tenancy';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CollectionDefinitionEntity } from './collection-definition.entity';
import { CORE_ID_COLUMN } from './core-id.column';

/**
 * The `collections_member` row: one product of a store collection at its position (D2300, D2318). The FK to its
 * definition by `(businessId, storeId, collectionId)` refuses an orphan and a row pointing at another store's
 * collection, and deletes the members with the definition (D2337, amended 2026-11-15). The check keeps `storeId` set,
 * since the FK checks nothing when one of its columns is null.
 */
@Entity('collections_member')
@Check('collections_member_store_required', '"storeId" IS NOT NULL')
@Index(['businessId', 'collectionId', 'productId'], { unique: true })
@Index(['businessId', 'storeId', 'productId'])
@Index(['businessId', 'collectionId', 'position', 'productId'])
export class CollectionMemberEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  collectionId!: string;

  @Column(CORE_ID_COLUMN)
  productId!: string;

  @Column({ type: 'integer' })
  position!: number;

  // Never loaded: it only declares the FK. Its join columns are the row's own `businessId`, `storeId` and
  // `collectionId`.
  @ManyToOne(() => CollectionDefinitionEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    { name: 'businessId', referencedColumnName: 'businessId' },
    { name: 'storeId', referencedColumnName: 'storeId' },
    { name: 'collectionId', referencedColumnName: 'collectionId' },
  ])
  definition?: CollectionDefinitionEntity;
}
