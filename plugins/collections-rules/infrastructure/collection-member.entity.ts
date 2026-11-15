import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CollectionDefinitionEntity } from './collection-definition.entity';
import { CORE_ID_COLUMN } from './core-id.column';

/**
 * The `collections_member` row: one product of a store collection at its position (D2300, D2318). The FK to its
 * definition by `(businessId, collectionId)` refuses an orphan and deletes the members with the definition (D2337).
 */
@Entity('collections_member')
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

  // Never loaded: it only declares the FK. Its join columns are the row's own `businessId` and `collectionId`.
  @ManyToOne(() => CollectionDefinitionEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    { name: 'businessId', referencedColumnName: 'businessId' },
    { name: 'collectionId', referencedColumnName: 'collectionId' },
  ])
  definition?: CollectionDefinitionEntity;
}
