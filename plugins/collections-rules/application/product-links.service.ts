import { COLLECTION_MAX_MANUAL_PRODUCTS, COLLECTIONS_PER_STORE_MAX } from '@cod/shared';
import type { CollectionDefinition } from '../domain/collection';
import { canonicalCoreId, canonicalCoreIds } from '../domain/core-id';
import { CollectionNotFoundError, TooManyManualProductsError } from '../domain/errors';
import type { MemberPlacement } from '../domain/ports/collection-member-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';

/** A collection as a product-side list names it: its id, its title and how it gets its products. */
export interface CollectionRefView {
  readonly id: string;
  readonly title: string;
  readonly manual: boolean;
}

const isManual = (definition: CollectionDefinition): boolean => definition.mode === 'manual';

/**
 * The product side of membership (D2309, D2324): which collections hold one product, and the hand-picked links a
 * product write replaces. Shared by the `storeProductCollections` operations and the source the catalog calls.
 */
export class ProductLinksService {
  constructor(private readonly ports: CollectionPorts) {}

  /** The store's definitions among `collectionIds`, by position then id; an id of none is absent. */
  async definitionsAmong(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<readonly CollectionDefinition[]> {
    const canonical = canonicalCoreIds(collectionIds);
    if (canonical.length === 0) return [];
    const page = await this.ports.definitions.list(ctx, scope, {
      skip: 0,
      take: COLLECTIONS_PER_STORE_MAX,
      collectionIds: canonical,
    });
    return page.items;
  }

  /** The manual collections of the store among `collectionIds`, canonical, in first-given order. */
  async manualAmong(ctx: OperationContext, scope: StoreScope, collectionIds: readonly string[]): Promise<string[]> {
    const manual = new Set(
      (await this.definitionsAmong(ctx, scope, collectionIds)).filter(isManual).map((item) => item.collectionId),
    );
    return canonicalCoreIds(collectionIds).filter((collectionId) => manual.has(collectionId));
  }

  /** The collections holding the product, by position, with titles; one whose Vendure collection left is skipped. */
  async collectionsOf(ctx: OperationContext, scope: StoreScope, productId: string): Promise<CollectionRefView[]> {
    const canonical = canonicalCoreId(productId);
    if (canonical === undefined) return [];
    const ids = (await this.ports.members.collectionIdsOfProducts(ctx, scope, [canonical])).get(canonical) ?? [];
    return this.refsOf(ctx, await this.definitionsAmong(ctx, scope, ids));
  }

  /** The products of a collection of the store, manual or matched; none for a malformed or foreign id. */
  async productIdsIn(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<string[]> {
    const canonical = canonicalCoreId(collectionId);
    if (canonical === undefined) return [];
    return (await this.ports.members.membersOf(ctx, scope, canonical)).map((member) => member.productId);
  }

  /** Every collection of the store with its title, by position (the catalog list's Collection filter, D2324). */
  async options(ctx: OperationContext, scope: StoreScope): Promise<CollectionRefView[]> {
    const page = await this.ports.definitions.list(ctx, scope, { skip: 0, take: COLLECTIONS_PER_STORE_MAX });
    return this.refsOf(ctx, page.items);
  }

  /**
   * A catalog product write (D2309): under the store lock, in the caller's transaction, the product's manual
   * collections become `collectionIds`. A collection that is not (or no longer) a manual one of the store refuses the
   * whole write, so a mode switch racing the product save never links an automatic collection.
   *
   * @throws {CollectionNotFoundError} when an id is not a manual collection of the store.
   * @throws {TooManyManualProductsError} when a collection is full.
   */
  async replaceManual(
    ctx: OperationContext,
    scope: StoreScope,
    productId: string,
    collectionIds: readonly string[],
  ): Promise<void> {
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const wanted = canonicalCoreIds(collectionIds);
      const manual = await this.manualAmong(tx, scope, wanted);
      if (manual.length !== wanted.length) throw new CollectionNotFoundError();
      await this.writeManual(tx, scope, productId, manual);
    });
  }

  /**
   * Makes the product's manual collections exactly `collectionIds` (checked manual ones of the store, canonical): it
   * joins the new ones last (D2318) and leaves the dropped ones; automatic memberships stay. Run under the store lock.
   * Publishes `collection.changed` (`membership`) for each collection joined or left.
   */
  async writeManual(
    tx: OperationContext,
    scope: StoreScope,
    productId: string,
    collectionIds: readonly string[],
  ): Promise<void> {
    const current = (await this.ports.members.collectionIdsOfProducts(tx, scope, [productId])).get(productId) ?? [];
    const target = new Set(collectionIds);
    const left = (await this.manualAmong(tx, scope, current)).filter((collectionId) => !target.has(collectionId));
    const joined = collectionIds.filter((collectionId) => !current.includes(collectionId));
    if (joined.length === 0 && left.length === 0) return;
    const placements = await this.placementsAtEnd(tx, scope, joined);
    await this.ports.members.setProductIn(tx, scope, productId, { in: placements, out: left });
    for (const collectionId of [...joined, ...left]) {
      await this.ports.events.publish(tx, scope, collectionId, 'membership');
    }
  }

  /** Removes a deleted product from every collection of the store, under the store lock (D2306, D2334). */
  async deleteProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    const canonical = canonicalCoreId(productId);
    if (canonical === undefined) return;
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const held = (await this.ports.members.collectionIdsOfProducts(tx, scope, [canonical])).get(canonical) ?? [];
      await this.ports.members.deleteProduct(tx, scope, canonical);
      for (const collectionId of held) await this.ports.events.publish(tx, scope, collectionId, 'membership');
    });
  }

  /** The place after the last member of each collection; a full one refuses (D2322, D2337). */
  private async placementsAtEnd(
    tx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<MemberPlacement[]> {
    if (collectionIds.length === 0) return [];
    const counts = await this.ports.members.countsOf(tx, scope, collectionIds);
    const placements: MemberPlacement[] = [];
    for (const collectionId of collectionIds) {
      if ((counts.get(collectionId) ?? 0) >= COLLECTION_MAX_MANUAL_PRODUCTS) throw new TooManyManualProductsError();
      placements.push({ collectionId, position: await this.ports.members.nextPosition(tx, scope, collectionId) });
    }
    return placements;
  }

  private async refsOf(
    ctx: OperationContext,
    definitions: readonly CollectionDefinition[],
  ): Promise<CollectionRefView[]> {
    if (definitions.length === 0) return [];
    const metas = await this.ports.vendure.findMany(
      ctx,
      definitions.map((definition) => definition.collectionId),
    );
    return definitions.flatMap((definition) => {
      const meta = metas.get(definition.collectionId);
      return meta === undefined
        ? []
        : [{ id: definition.collectionId, title: meta.title, manual: isManual(definition) }];
    });
  }
}
