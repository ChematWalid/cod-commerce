import { RateLimit } from '@cod/plugin-rate-limit';
import { StorefrontCtx, StorefrontScoped } from '@cod/plugin-tenancy';
import type {
  StorefrontCollectionList,
  StorefrontCollectionPage,
  StorefrontProduct,
  StorefrontProductPage,
} from '@cod/shared';
import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import { Allow, Permission, type RequestContext } from '@vendure/core';
import { StorefrontCatalogService } from '../application/storefront-catalog.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { collectionFilterOf, listingOf, type RawQuery, slugOf } from './dto';
import { found, StorefrontErrorFilter } from './error-mapping';

/**
 * The storefront's public catalog (P3.S2), under `/store`, which the internal-only middleware already signs (D111):
 * every handler runs as the signed, active store (D3201) and is limited per buyer address (D3213). Public: buyers have
 * no session. Unknown, hidden and malformed answer 404 with an empty body. `product/search` is declared before
 * `product/:slug`, so a slug can never shadow it (the catalog reserves the slug `search`).
 */
@Controller('store')
@StorefrontScoped()
@UseFilters(StorefrontErrorFilter)
export class StorefrontCatalogController {
  constructor(private readonly catalog: StorefrontCatalogService) {}

  /** One page of the store's listed products, optionally of one collection (`?collection=<slug>`). */
  @Get('products')
  @Allow(Permission.Public)
  @RateLimit('storefront-read')
  async products(@StorefrontCtx() ctx: RequestContext, @Query() query: RawQuery): Promise<StorefrontProductPage> {
    const filter = found(collectionFilterOf(query));
    return found(await this.catalog.listProducts(asOperationContext(ctx), { ...listingOf(query), ...filter }));
  }

  /** A search of the store's listed products (`?q=`); Task 6c fills it. */
  @Get('product/search')
  @Allow(Permission.Public)
  @RateLimit('storefront-read')
  search(@StorefrontCtx() ctx: RequestContext, @Query() query: RawQuery): Promise<StorefrontProductPage> {
    return this.catalog.searchProducts(asOperationContext(ctx), listingOf(query));
  }

  /** The product page of a slug. */
  @Get('product/:slug')
  @Allow(Permission.Public)
  @RateLimit('storefront-read')
  async product(@StorefrontCtx() ctx: RequestContext, @Param('slug') slug: unknown): Promise<StorefrontProduct> {
    return found(await this.catalog.productBySlug(asOperationContext(ctx), found(slugOf(slug))));
  }

  /** The store's visible collections, by position. */
  @Get('collections')
  @Allow(Permission.Public)
  @RateLimit('storefront-read')
  collections(@StorefrontCtx() ctx: RequestContext): Promise<StorefrontCollectionList> {
    return this.catalog.collections(asOperationContext(ctx));
  }

  /** A visible collection and one page of its listed products. */
  @Get('collection/:slug')
  @Allow(Permission.Public)
  @RateLimit('storefront-read')
  async collection(
    @StorefrontCtx() ctx: RequestContext,
    @Param('slug') slug: unknown,
    @Query() query: RawQuery,
  ): Promise<StorefrontCollectionPage> {
    const page = await this.catalog.collectionPage(asOperationContext(ctx), found(slugOf(slug)), listingOf(query));
    return found(page);
  }
}
