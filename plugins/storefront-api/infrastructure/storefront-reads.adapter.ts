import { asCatalogOperationContext, CatalogReadService } from '@cod/plugin-catalog';
import {
  asCollectionsOperationContext,
  CollectionsReadService,
  type VisibleCollection,
} from '@cod/plugin-collections-rules';
import { SLUG_QUERY_MAX, type StorefrontCollection, type StorefrontProduct } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StorefrontReadsPort } from '../domain/ports/storefront-reads.port';
import { toRequestContext } from './request-scope';
import { storefrontProductOf } from './storefront-product-of';

/**
 * A visible collection as the storefront reads it. On a storefront context (built without a request) the collections
 * read answers the image's storage path, the same shape as product images (D3217 (b)).
 */
const storefrontCollectionOf = (collection: VisibleCollection): StorefrontCollection => ({
  id: collection.id,
  slug: collection.slug,
  title: collection.title,
  description: collection.description ?? '',
  imagePath: collection.featuredAsset?.preview ?? null,
});

/** Whether a slug is worth a lookup; a longer one names nothing either way. */
const isReadableSlug = (slug: string): boolean => slug.length > 0 && slug.length <= SLUG_QUERY_MAX;

/**
 * {@link StorefrontReadsPort} over the catalog's and collections' exported public reads (D3206), which take the store
 * from the storefront context and apply visibility themselves.
 */
@Injectable()
export class CatalogStorefrontReads implements StorefrontReadsPort {
  constructor(
    private readonly catalog: CatalogReadService,
    private readonly collectionsRead: CollectionsReadService,
  ) {}

  async productBySlug(ctx: OperationContext, slug: string): Promise<StorefrontProduct | undefined> {
    if (!isReadableSlug(slug)) return undefined;
    const request = asCatalogOperationContext(toRequestContext(ctx));
    const product = await this.catalog.findBySlug(request, slug, 'productPage');
    return product === undefined ? undefined : storefrontProductOf(product);
  }

  async collections(ctx: OperationContext, take: number): Promise<readonly StorefrontCollection[]> {
    const request = asCollectionsOperationContext(toRequestContext(ctx));
    const page = await this.collectionsRead.listVisible(request, { skip: 0, take });
    return page.items.map(storefrontCollectionOf);
  }

  async collectionBySlug(ctx: OperationContext, slug: string): Promise<StorefrontCollection | undefined> {
    if (!isReadableSlug(slug)) return undefined;
    const request = asCollectionsOperationContext(toRequestContext(ctx));
    const collection = await this.collectionsRead.findVisibleBySlug(request, slug);
    return collection === undefined ? undefined : storefrontCollectionOf(collection);
  }

  memberIds(ctx: OperationContext, collectionId: string): Promise<readonly string[] | undefined> {
    return this.collectionsRead.visibleMemberIds(asCollectionsOperationContext(toRequestContext(ctx)), collectionId);
  }
}
