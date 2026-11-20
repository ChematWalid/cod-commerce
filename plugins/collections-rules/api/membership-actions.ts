import {
  setStoreCollectionProductsInputSchema,
  setStoreProductCollectionsInputSchema,
  storeCollectionProductsQuerySchema,
  storeCollectionSlugQuerySchema,
} from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { CollectionProductsService } from '../application/collection-products.service';
import type { StoreProductCollectionsView } from '../application/product-collections.service';
import { ProductCollectionsService } from '../application/product-collections.service';
import { SetCollectionProductsService } from '../application/set-collection-products.service';
import { type SlugAvailabilityView, SlugAvailabilityService } from '../application/slug-availability.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { type StoreCollectionDto, type StoreCollectionProductListDto, toCollectionDto } from './dto';
import { idArgOf, parseInput } from './request-body';
import { scopeOf } from './store-scope-of';

/** The membership and slug use cases. */
@Injectable()
export class MembershipUseCases {
  constructor(
    readonly products: CollectionProductsService,
    readonly setProducts: SetCollectionProductsService,
    readonly productCollections: ProductCollectionsService,
    readonly slugs: SlugAvailabilityService,
  ) {}
}

/** A field of a REST body or GraphQL argument object; anything else reads as absent. */
const fieldOf = (body: unknown, field: string): unknown =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[field] : undefined;

/**
 * The products of a collection, the collections of a product and slug availability, for both API surfaces (team
 * pattern of {@link CollectionsActions}): parse with the shared schema, store from the session, run, shape.
 */
@Injectable()
export class MembershipActions {
  constructor(private readonly useCases: MembershipUseCases) {}

  async products(ctx: RequestContext, id: unknown, options: unknown): Promise<StoreCollectionProductListDto> {
    const page = parseInput(storeCollectionProductsQuerySchema, options ?? {});
    return this.useCases.products.list(asOperationContext(ctx), scopeOf(ctx), idArgOf(id), page);
  }

  async setProducts(ctx: RequestContext, id: unknown, body: unknown): Promise<StoreCollectionDto> {
    const command = parseInput(setStoreCollectionProductsInputSchema, { productIds: fieldOf(body, 'productIds') });
    const view = await this.useCases.setProducts.set(asOperationContext(ctx), scopeOf(ctx), idArgOf(id), command);
    return toCollectionDto(view);
  }

  slugAvailability(ctx: RequestContext, query: unknown): Promise<SlugAvailabilityView> {
    const parsed = parseInput(storeCollectionSlugQuerySchema, query ?? {});
    return this.useCases.slugs.check(asOperationContext(ctx), parsed);
  }

  productCollections(ctx: RequestContext, productId: unknown): Promise<StoreProductCollectionsView> {
    return this.useCases.productCollections.of(asOperationContext(ctx), scopeOf(ctx), idArgOf(productId));
  }

  setProductCollections(ctx: RequestContext, productId: unknown, body: unknown): Promise<StoreProductCollectionsView> {
    const command = parseInput(setStoreProductCollectionsInputSchema, {
      productId: idArgOf(productId),
      collectionIds: fieldOf(body, 'collectionIds'),
    });
    return this.useCases.productCollections.set(asOperationContext(ctx), scopeOf(ctx), command);
  }
}
