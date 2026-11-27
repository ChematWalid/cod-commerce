import { CATALOG_MAX_PAGE_SIZE, COLLECTION_MAX_MANUAL_PRODUCTS } from '@cod/shared';
import { CATALOG_MAX_AMONG_IDS } from '../domain/constants';
import { type CoreId, parseCoreId } from '../domain/core-id';
import { InvalidCatalogInputError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { VisibilityCriteria } from '../domain/ports/product-catalog.port';
import type { ActiveStore } from '../domain/ports/store-settings.port';
import type { ProductRecord } from '../domain/product';
import { isOrderable } from '../domain/sold-out';
import {
  hidesSoldOutIn,
  isPublicListContext,
  isPublicVisibilityContext,
  isVisibleIn,
  type PublicListContext,
  type PublicVisibilityContext,
  statusesShownIn,
} from '../domain/visibility';
import type { ProductPorts } from './catalog-ports';
import { viewOf } from './product-view';
import { imageIdsOf, type ImagePreviews, type VisibleProduct, visibleProductOf } from './visible-product';

export type { VisibleImage, VisibleProduct, VisibleProductSettings, VisibleVariant } from './visible-product';

/** One page of the products a public context shows, and how many it shows in all. */
export interface VisibleProductPage {
  readonly items: readonly VisibleProduct[];
  readonly totalItems: number;
}

/** Which page of a public list: at most `CATALOG_MAX_PAGE_SIZE` products. */
export interface CatalogReadOptions {
  readonly skip: number;
  readonly take: number;
}

/** A page of a public list, optionally limited to some products (an automatic collection's members, D2310). */
export interface CatalogListOptions extends CatalogReadOptions {
  /** Only these products, at most `CATALOG_MAX_AMONG_IDS`; a malformed id names none. */
  readonly productIds?: readonly CoreId[];
}

/** A public read was asked from a context that names no active store of a tenant (D2142): a fault of the caller. */
export class NoActiveStoreError extends Error {
  constructor() {
    super('A catalog read needs the active store of a resolved tenant');
    this.name = 'NoActiveStoreError';
  }
}

const isPage = ({ skip, take }: CatalogReadOptions): boolean =>
  Number.isSafeInteger(skip) && skip >= 0 && Number.isSafeInteger(take) && take >= 1 && take <= CATALOG_MAX_PAGE_SIZE;

/** The well-formed ids among `ids`, each once at its first place: a malformed id never reaches Postgres (D2136). */
const parsedIdsOf = (ids: readonly string[]): CoreId[] => [...new Set(ids.flatMap((id) => parseCoreId(id) ?? []))];

/**
 * The store's products as the storefront, its product pages and its landing pages may show them (AC2, AC6, D2109),
 * for P3.S2/P3.S3/P3.S4; no public endpoint serves it in P2.S1. The store is the active store of the context, never an
 * argument (D2142): a draft is never returned, a hidden product only by its slug on a landing page, and a store that
 * hides sold-out products keeps them out of lists and product pages. Every item says whether it is sold out and
 * orderable, and carries only what a buyer may see: no hidden variant, barcode or merchant-only setting. Only public contexts are accepted, checked at run time too, so a context forwarded from a request can
 * never widen the read to the merchant's view or list the hidden products.
 */
export class CatalogReadService {
  constructor(private readonly ports: ProductPorts) {}

  /**
   * One page of the products `context` lists, newest first.
   *
   * @throws {NoActiveStoreError} for a context without an active store.
   * @throws {InvalidCatalogInputError} for a page outside the bounds or a context that lists nothing publicly.
   */
  async listVisible(
    ctx: OperationContext,
    context: PublicListContext,
    options: CatalogListOptions,
  ): Promise<VisibleProductPage> {
    const { skip, take, productIds } = options;
    if (!isPublicListContext(context) || !isPage(options)) throw new InvalidCatalogInputError();
    if (productIds !== undefined && productIds.length > CATALOG_MAX_AMONG_IDS) throw new InvalidCatalogInputError();
    const store = await this.activeStore(ctx);
    const page = await this.ports.products.list(ctx, {
      skip,
      take,
      ...(await this.criteriaOf(ctx, store, context)),
      ...(productIds === undefined ? {} : { productIds: parsedIdsOf(productIds) }),
    });
    return { items: await this.visibleOf(ctx, store, page.items), totalItems: page.totalItems };
  }

  /**
   * One page of the products `context` lists among `productIds`, in their given order (a manual collection, D2310);
   * only the page's records are read. Ids of another store, unknown or malformed ids and repeats are left out.
   *
   * @throws {NoActiveStoreError} for a context without an active store.
   * @throws {InvalidCatalogInputError} for more than `COLLECTION_MAX_MANUAL_PRODUCTS` ids, a page outside the bounds
   *   or a context that lists nothing publicly.
   */
  async listVisibleAmong(
    ctx: OperationContext,
    context: PublicListContext,
    productIds: readonly CoreId[],
    options: CatalogReadOptions,
  ): Promise<VisibleProductPage> {
    const tooMany = productIds.length > COLLECTION_MAX_MANUAL_PRODUCTS;
    if (!isPublicListContext(context) || !isPage(options) || tooMany) throw new InvalidCatalogInputError();
    const store = await this.activeStore(ctx);
    const ids = parsedIdsOf(productIds);
    const visible =
      ids.length === 0
        ? []
        : await this.ports.products.visibleIdsAmong(ctx, await this.criteriaOf(ctx, store, context), ids);
    const pageIds = visible.slice(options.skip, options.skip + options.take);
    const records = await Promise.all(pageIds.map((id) => this.ports.products.findOne(ctx, id)));
    const items = await this.visibleOf(
      ctx,
      store,
      records.filter((record) => record !== undefined),
    );
    return { items, totalItems: visible.length };
  }

  /**
   * The product whose slug is `slug`, if `context` shows it.
   *
   * @throws {NoActiveStoreError} for a context without an active store.
   * @throws {InvalidCatalogInputError} for a context that is not public.
   */
  async findBySlug(
    ctx: OperationContext,
    slug: string,
    context: PublicVisibilityContext,
  ): Promise<VisibleProduct | undefined> {
    if (!isPublicVisibilityContext(context)) throw new InvalidCatalogInputError();
    const store = await this.activeStore(ctx);
    const record = await this.recordBySlug(ctx, slug);
    if (record === undefined) return undefined;
    const [product] = await this.visibleOf(ctx, store, [record]);
    if (product === undefined || !isVisibleIn(product, context, store.soldOutBehavior)) return undefined;
    return product;
  }

  /** The statuses `context` shows and the sold-out products it hides in `store` (D2109). */
  private async criteriaOf(
    ctx: OperationContext,
    { scope, soldOutBehavior }: ActiveStore,
    context: PublicListContext,
  ): Promise<VisibilityCriteria> {
    const hidden = hidesSoldOutIn(context, soldOutBehavior)
      ? await this.ports.soldOut.allSoldOutIds(ctx, scope, scope.storeId)
      : [];
    const statuses = statusesShownIn(context);
    return {
      ...(statuses === undefined ? {} : { statuses }),
      ...(hidden.length === 0 ? {} : { excludedProductIds: hidden }),
    };
  }

  private async activeStore(ctx: OperationContext): Promise<ActiveStore> {
    const store = await this.ports.stores.activeStoreOf(ctx);
    if (store === undefined) throw new NoActiveStoreError();
    return store;
  }

  /** The live product holding `slug`; a slug no product could hold (empty, too long once stored) names none. */
  private async recordBySlug(ctx: OperationContext, slug: string): Promise<ProductRecord | undefined> {
    try {
      const { productId } = await this.ports.products.findBySlug(ctx, slug);
      return productId === undefined ? undefined : await this.ports.products.findOne(ctx, productId);
    } catch (error: unknown) {
      if (error instanceof InvalidCatalogInputError) return undefined;
      throw error;
    }
  }

  /** The public shape of `records`, with their sold-out state and image previews each read once for the page. */
  private async visibleOf(
    ctx: OperationContext,
    { scope }: ActiveStore,
    records: readonly ProductRecord[],
  ): Promise<VisibleProduct[]> {
    if (records.length === 0) return [];
    const ids = records.map((record) => record.id);
    const soldOut = await this.ports.soldOut.soldOutIds(ctx, scope, scope.storeId, ids);
    const views = await Promise.all(records.map((record) => viewOf(this.ports, ctx, scope, record)));
    const previews = await this.previewsOf(ctx, views.flatMap(imageIdsOf));
    return views.map((view) => {
      const state = { soldOut: soldOut.has(view.id), allowOutOfStockOrders: view.settings.allowOutOfStockOrders };
      return visibleProductOf(view, { soldOut: state.soldOut, orderable: isOrderable(state) }, previews);
    });
  }

  /** One storage read for every image of a page; a page without images reads nothing. */
  private previewsOf(ctx: OperationContext, imageIds: readonly CoreId[]): Promise<ImagePreviews> {
    const unique = [...new Set(imageIds)];
    return unique.length === 0 ? Promise.resolve(new Map()) : this.ports.storage.previewsOf(ctx, unique);
  }
}
