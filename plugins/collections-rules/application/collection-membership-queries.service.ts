import { canonicalCoreId, canonicalCoreIds } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';

/**
 * Collection membership for other plugins (D2317): offer targets (P2.S4, P2.S5) and storefront pages (P3.S2). The
 * scope is named by the caller, so a consumer or job context works as well as a request one; every answer is of that
 * store only. Membership is eventually consistent with product edits (outbox lag, seconds), and drafts, hidden and
 * sold-out products are members (D2306). A malformed id names nothing and never reaches Postgres.
 *
 * The answers are merchant-level, never buyer-safe: they include hidden collections and draft or hidden products, so
 * anything shown to a buyer goes through `CollectionsReadService`. The scope comes from the tenant or active store of
 * the context (`tenantOf`, the active store), never from request input.
 */
export class CollectionMembershipQueries {
  constructor(private readonly ports: Pick<CollectionPorts, 'definitions' | 'members'>) {}

  /**
   * Every member of a collection of the store, rule or hand-picked, in collection order (D2318). Unbounded: an
   * automatic collection may return tens of thousands of ids, so an order path prefers `isMember` or
   * `collectionIdsOfProducts`.
   */
  async productIdsOf(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<readonly string[]> {
    const canonical = canonicalCoreId(collectionId);
    if (canonical === undefined) return [];
    const members = await this.ports.members.membersOf(ctx, scope, canonical);
    return members.map((member) => member.productId);
  }

  /**
   * The store's collections of each given product, in one query (a cart of N lines), keyed by canonical product id
   * in collection id order; a product of none is absent.
   */
  async collectionIdsOfProducts(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const canonical = canonicalCoreIds(productIds);
    if (canonical.length === 0) return new Map();
    return this.ports.members.collectionIdsOfProducts(ctx, scope, canonical);
  }

  /** Whether the product is a member of the store's collection. */
  async isMember(ctx: OperationContext, scope: StoreScope, collectionId: string, productId: string): Promise<boolean> {
    const [canonicalCollection, canonicalProduct] = [canonicalCoreId(collectionId), canonicalCoreId(productId)];
    if (canonicalCollection === undefined || canonicalProduct === undefined) return false;
    const found = await this.ports.members.collectionIdsOfProducts(ctx, scope, [canonicalProduct]);
    return found.get(canonicalProduct)?.includes(canonicalCollection) === true;
  }

  /** Those of `collectionIds` that are collections of the store (offer target checks), canonical, each once. */
  existingCollectionIds(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<readonly string[]> {
    return this.ports.definitions.existing(ctx, scope, collectionIds);
  }
}
