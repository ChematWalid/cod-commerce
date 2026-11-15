import type { Snowflake } from '@cod/shared';
import type { PackDefinition, PackRecord, PackStatus } from '../pack';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** What a save stores for one pack product: its status and definition; the components replace the stored ones. */
export interface PackSave {
  readonly productId: string;
  readonly status: PackStatus;
  readonly definition: PackDefinition;
}

/** A status change of one stored pack. */
export interface PackStatusChange {
  readonly packId: Snowflake;
  readonly status: PackStatus;
}

/** The stored packs of a store (`catalog_pack`, `catalog_pack_component`); every call names business and store. */
export interface PackRepositoryPort {
  /** The pack of pack product `productId`, or `undefined`. */
  findByProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<PackRecord | undefined>;
  /** Every pack with a component line on product `productId`. */
  holding(ctx: OperationContext, scope: StoreScope, productId: string): Promise<readonly PackRecord[]>;
  /** Inserts or replaces the pack of `pack.productId`, components included. */
  save(ctx: OperationContext, scope: StoreScope, pack: PackSave): Promise<PackRecord>;
  /** Sets the status of stored pack `change.packId`, leaving its definition as it is. */
  setStatus(ctx: OperationContext, scope: StoreScope, change: PackStatusChange): Promise<void>;
  /** Removes the pack of `productId` and its components, if any. */
  deleteByProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void>;
}
