import { TenantEntity } from '@cod/plugin-tenancy';
import type { CollectionRule } from '@cod/shared';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { CORE_ID_COLUMN } from './core-id.column';

/** Room for the longest of `COLLECTION_MODES` and `RULE_MATCHES`. */
const MODE_LENGTH = 16;

/**
 * The `collections_definition` row of a store collection (D2300): how the Vendure `Collection` of the same id gets its
 * products, its rule (jsonb, the shared schema's output), the normal-form version its members were built with
 * (D2336), its visibility (mirrored to Vendure `isPrivate`) and its position in the store (D2318). One row per
 * collection of a business; members reference it (FK, D2337).
 */
@Entity('collections_definition')
@Index(['businessId', 'collectionId'], { unique: true })
@Index(['businessId', 'storeId', 'position', 'id'])
export class CollectionDefinitionEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column(CORE_ID_COLUMN)
  collectionId!: string;

  @Column({ type: 'varchar', length: MODE_LENGTH })
  mode!: string;

  /** The rule's `match`, beside the rule for readers that need no jsonb; `null` for a manual collection. */
  @Column({ type: 'varchar', length: MODE_LENGTH, nullable: true })
  match!: string | null;

  /** As written; read back through the shared schema, since a jsonb column holds whatever was stored. */
  @Column({ type: 'jsonb', nullable: true })
  rule!: CollectionRule | null;

  @Column({ type: 'integer' })
  matchVersion!: number;

  @Column({ type: 'boolean' })
  visible!: boolean;

  @Column({ type: 'integer' })
  position!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
