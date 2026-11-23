import type {
  StorefrontCollection,
  StorefrontCollectionList,
  StorefrontCollectionPage,
  StorefrontProduct,
  StorefrontProductPage,
} from '@cod/shared';
import { STOREFRONT_COLLECTIONS_MAX } from '../domain/constants';
import { type ListingQuery, listingQueryOf, type RawListingQuery } from '../domain/listing-query';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProjectionRepositoryPort } from '../domain/ports/projection-repository.port';
import type { StorefrontReadsPort } from '../domain/ports/storefront-reads.port';
import type { StorefrontStorePort } from '../domain/ports/storefront-store.port';
import { emptyProductPage, productPageOf } from './product-card';

/** What the storefront catalog reads through. */
export interface StorefrontCatalogPorts {
  readonly stores: StorefrontStorePort;
  readonly projection: ProjectionRepositoryPort;
  readonly reads: StorefrontReadsPort;
}

/** A product list request: a page, and optionally the slug of the collection it is narrowed to. */
export interface ProductListRequest extends RawListingQuery {
  readonly collection?: string;
}

/**
 * The storefront's public catalog (P3.S2): lists read the store's projection, where `listed` already folds
 * visibility and sold-out hiding (D3205); product pages and collections read the catalog and collections plugins,
 * which own visibility (D3206, ADR 0017). The store is always the one of the storefront context, never an argument.
 * `undefined` means "not found" for the API: an unknown, hidden or other store's product or collection.
 */
export class StorefrontCatalogService {
  constructor(private readonly ports: StorefrontCatalogPorts) {}

  /** One page of the store's listed products, narrowed to a visible collection's members when one is named. */
  async listProducts(ctx: OperationContext, request: ProductListRequest): Promise<StorefrontProductPage | undefined> {
    const query = listingQueryOf(request);
    if (request.collection === undefined) return this.listedPage(ctx, query);
    const collection = await this.ports.reads.collectionBySlug(ctx, request.collection);
    return collection === undefined ? undefined : this.collectionProducts(ctx, collection, query);
  }

  /** The product page of `slug`. */
  productBySlug(ctx: OperationContext, slug: string): Promise<StorefrontProduct | undefined> {
    return this.ports.reads.productBySlug(ctx, slug);
  }

  /** The store's visible collections, by position. */
  async collections(ctx: OperationContext): Promise<StorefrontCollectionList> {
    return { items: [...(await this.ports.reads.collections(ctx, STOREFRONT_COLLECTIONS_MAX))] };
  }

  /** A visible collection and the first page (or the page asked) of its listed products. */
  async collectionPage(
    ctx: OperationContext,
    slug: string,
    raw: RawListingQuery,
  ): Promise<StorefrontCollectionPage | undefined> {
    const collection = await this.ports.reads.collectionBySlug(ctx, slug);
    if (collection === undefined) return undefined;
    const products = await this.collectionProducts(ctx, collection, listingQueryOf(raw));
    return { collection, products };
  }

  private async listedPage(
    ctx: OperationContext,
    query: ListingQuery,
    productIds?: readonly string[],
  ): Promise<StorefrontProductPage> {
    const { scope } = this.ports.stores.storeOf(ctx);
    const listing = productIds === undefined ? query : { ...query, productIds };
    return productPageOf(await this.ports.projection.listed(ctx, scope, listing), query);
  }

  /** The collection's members joined with the projection, so paging and price order span the whole collection. */
  private async collectionProducts(
    ctx: OperationContext,
    collection: StorefrontCollection,
    query: ListingQuery,
  ): Promise<StorefrontProductPage> {
    const members = await this.ports.reads.memberIds(ctx, collection.id);
    if (members === undefined || members.length === 0) return emptyProductPage(query);
    return this.listedPage(ctx, query, members);
  }
}
