import { CATALOG_MAX_PAGE_SIZE, COLLECTION_LIST_MAX_TAKE } from '@cod/shared';
import type { CollectionDefinition } from '../domain/collection';
import { canonicalCoreId } from '../domain/core-id';
import { InvalidCollectionInputError } from '../domain/errors';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { CollectionImage } from '../domain/ports/vendure-collections.port';
import type { ProductPage, VisibleProductsPort } from '../domain/ports/visible-products.port';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';

/** A collection as a buyer may see it: no mode, rule or member count. */
export interface VisibleCollection {
  /** The Vendure collection id. */
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly featuredAsset: CollectionImage | null;
  readonly position: number;
}

/** One page of the visible collections of a store and how many it shows in all. */
export interface VisibleCollectionPage {
  readonly items: readonly VisibleCollection[];
  readonly totalItems: number;
}

const isPage = ({ skip, take }: ProductPage, maxTake: number): boolean =>
  Number.isSafeInteger(skip) && skip >= 0 && Number.isSafeInteger(take) && take >= 1 && take <= maxTake;

/**
 * The store's collections as the storefront may show them (D2316), for P3.S2: only visible collections, by position,
 * and their products through the catalog's visibility rules (D2306). The store is the active store of the context,
 * on its own channel, never an argument (D2142); a hidden, foreign, other-store or unknown collection reads like none.
 * `TContext` and `TPage` are the catalog's public list context and product page, bound in `infrastructure/`.
 */
export class CollectionsReadService<TContext, TPage> {
  constructor(
    private readonly ports: Pick<CollectionPorts, 'definitions' | 'members' | 'vendure'>,
    private readonly stores: ActiveStorePort,
    private readonly products: VisibleProductsPort<TContext, TPage>,
  ) {}

  /**
   * One page of the visible collections, ordered by position, then id (D2318).
   *
   * @throws {CollectionsNoActiveStoreError} for a context without an active store on its channel.
   * @throws {InvalidCollectionInputError} for a page outside the bounds.
   */
  async listVisible(ctx: OperationContext, page: ProductPage): Promise<VisibleCollectionPage> {
    if (!isPage(page, COLLECTION_LIST_MAX_TAKE)) throw new InvalidCollectionInputError();
    const scope = await this.stores.activeStoreOf(ctx);
    const { items, totalItems } = await this.ports.definitions.list(ctx, scope, { ...page, visibleOnly: true });
    if (items.length === 0) return { items: [], totalItems };
    const metas = await this.ports.vendure.findMany(
      ctx,
      items.map((definition) => definition.collectionId),
    );
    // A definition whose Vendure collection left the store channel names nothing the store can show.
    const visible = items.flatMap(({ collectionId, position }) => {
      const meta = metas.get(collectionId);
      return meta === undefined ? [] : [{ id: collectionId, ...meta, position }];
    });
    return { items: visible, totalItems };
  }

  /**
   * One page of a visible collection's products: in hand order for a manual one, newest first for an automatic one
   * (D2310, D2318); `undefined` for a hidden, foreign, other-store, unknown or malformed collection id.
   *
   * @throws {CollectionsNoActiveStoreError} for a context without an active store on its channel.
   * @throws {InvalidCollectionInputError} for a page outside the bounds; the catalog refuses a non-public context.
   */
  async productsOf(
    ctx: OperationContext,
    rawCollectionId: string,
    context: TContext,
    page: ProductPage,
  ): Promise<TPage | undefined> {
    if (!isPage(page, CATALOG_MAX_PAGE_SIZE)) throw new InvalidCollectionInputError();
    const scope = await this.stores.activeStoreOf(ctx);
    const definition = await this.visibleDefinition(ctx, scope, rawCollectionId);
    if (definition === undefined) return undefined;
    const { collectionId } = definition;
    if (definition.mode === 'manual') {
      const members = await this.ports.members.membersOf(ctx, scope, collectionId);
      return this.products.among(ctx, context, idsOf(members), page);
    }
    // One past the cap, so the catalog adapter sees and logs a collection it lists only partly (D2310).
    const newest = { skip: 0, take: this.products.maxNewestIds + 1 };
    const members = await this.ports.members.membersPage(ctx, scope, collectionId, newest);
    return this.products.newestAmong(ctx, context, idsOf(members), page);
  }

  /** The store's visible definition of a collection whose Vendure collection is still in the store channel. */
  private async visibleDefinition(
    ctx: OperationContext,
    scope: StoreScope,
    rawCollectionId: string,
  ): Promise<CollectionDefinition | undefined> {
    const collectionId = canonicalCoreId(rawCollectionId);
    if (collectionId === undefined) return undefined;
    const definition = await this.ports.definitions.findByCollectionId(ctx, scope, collectionId);
    if (definition?.visible !== true) return undefined;
    const live = await this.ports.vendure.findMany(ctx, [collectionId]);
    return live.has(collectionId) ? definition : undefined;
  }
}

const idsOf = (members: readonly { readonly productId: string }[]): string[] =>
  members.map((member) => member.productId);
