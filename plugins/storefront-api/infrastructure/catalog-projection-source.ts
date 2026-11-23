import {
  asCatalogOperationContext,
  CatalogProductFactsReader,
  CatalogProductQueries,
  CatalogReadService,
  parseCoreId,
  type VisibleProduct,
} from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import { canonicalCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductIdPage, ProjectionSource, ProjectionSourcePort } from '../domain/ports/projection-source.port';
import type { ProjectedProduct } from '../domain/projection-row';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** The landing-page view of a product as the projection reads it, field by field. */
export const projectedProductOf = (product: VisibleProduct): ProjectedProduct => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  status: product.status,
  price: product.price,
  oldPrice: product.oldPrice,
  variants: product.variants.map(({ price, oldPrice }) => ({ price, oldPrice })),
  imagePath: product.featuredAsset?.preview ?? null,
  createdAt: product.createdAt,
});

/**
 * {@link ProjectionSourcePort} over the catalog's exported facades, on a storefront context of the store (D3201): the
 * product's slug from the store's catalog, then its public `landingPage` view, which shows active and hidden products
 * whether sold out or not, never a draft (D2109). Store ids come from the facades' own scope checks.
 */
@Injectable()
export class CatalogProjectionSource implements ProjectionSourcePort {
  constructor(
    private readonly products: CatalogProductQueries,
    private readonly reads: CatalogReadService,
    private readonly facts: CatalogProductFactsReader,
  ) {}

  async productOf(ctx: OperationContext, productId: string): Promise<ProjectionSource | undefined> {
    const id = canonicalCoreId(productId);
    if (id === undefined) return undefined;
    const request = toRequestContext(ctx);
    const view = await this.products.byId(request, id);
    if (view === undefined || view.status === 'draft') return undefined;
    const product = await this.reads.findBySlug(asCatalogOperationContext(request), view.slug, 'landingPage');
    // The slug may have moved to another product between the two reads: the next event of each corrects it.
    if (product?.id !== id) return undefined;
    return { product: projectedProductOf(product), soldOut: product.soldOut };
  }

  async productIds(
    ctx: OperationContext,
    scope: StoreScope,
    after: string | null,
    take: number,
  ): Promise<ProductIdPage> {
    const cursor = after === null ? null : parseCoreId(after);
    if (cursor === undefined) return { ids: [], next: null };
    const page = await this.facts.pageIds(toRequestContext(ctx), scope, { after: cursor, take });
    return { ids: page.ids, next: page.next };
  }
}
