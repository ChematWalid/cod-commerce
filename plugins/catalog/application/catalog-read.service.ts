import { CATALOG_MAX_PAGE_SIZE } from '@cod/shared';
import { InvalidCatalogInputError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
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
import { type ProductView, viewOf } from './product-view';

/** A product as a public context shows it: whether it is sold out, and whether a buyer may still order it. */
export interface VisibleProduct extends ProductView {
  readonly soldOut: boolean;
  /** Not sold out, or its orders stay open while sold out (D2108). */
  readonly orderable: boolean;
}

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

/** A public read was asked from a context that names no active store of a tenant (D2142): a fault of the caller. */
export class NoActiveStoreError extends Error {
  constructor() {
    super('A catalog read needs the active store of a resolved tenant');
    this.name = 'NoActiveStoreError';
  }
}

const isPage = ({ skip, take }: CatalogReadOptions): boolean =>
  Number.isSafeInteger(skip) && skip >= 0 && Number.isSafeInteger(take) && take >= 1 && take <= CATALOG_MAX_PAGE_SIZE;

/**
 * The store's products as the storefront, its product pages and its landing pages may show them (AC2, AC6, D2109),
 * for P3.S2/P3.S3/P3.S4; no public endpoint serves it in P2.S1. The store is the active store of the context, never an
 * argument (D2142): a draft is never returned, a hidden product only by its slug on a landing page, and a store that
 * hides sold-out products keeps them out of lists and product pages. Every item says whether it is sold out and
 * orderable. Only public contexts are accepted, checked at run time too, so a context forwarded from a request can
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
    options: CatalogReadOptions,
  ): Promise<VisibleProductPage> {
    if (!isPublicListContext(context) || !isPage(options)) throw new InvalidCatalogInputError();
    const store = await this.activeStore(ctx);
    const { scope } = store;
    const hidden = hidesSoldOutIn(context, store.soldOutBehavior)
      ? await this.ports.soldOut.allSoldOutIds(ctx, scope, scope.storeId)
      : [];
    const statuses = statusesShownIn(context);
    const page = await this.ports.products.list(ctx, {
      ...options,
      ...(statuses === undefined ? {} : { statuses }),
      ...(hidden.length === 0 ? {} : { excludedProductIds: hidden }),
    });
    return { items: await this.visibleOf(ctx, store, page.items), totalItems: page.totalItems };
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

  private async visibleOf(
    ctx: OperationContext,
    { scope }: ActiveStore,
    records: readonly ProductRecord[],
  ): Promise<VisibleProduct[]> {
    const ids = records.map((record) => record.id);
    const soldOut =
      ids.length === 0 ? new Set<string>() : await this.ports.soldOut.soldOutIds(ctx, scope, scope.storeId, ids);
    return Promise.all(
      records.map(async (record) => {
        const view = await viewOf(this.ports, ctx, scope, record);
        const state = { soldOut: soldOut.has(record.id), allowOutOfStockOrders: view.settings.allowOutOfStockOrders };
        return { ...view, soldOut: state.soldOut, orderable: isOrderable(state) };
      }),
    );
  }
}
