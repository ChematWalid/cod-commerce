import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import type { StoreProductCollectionsView } from '../application/product-collections.service';
import type { SlugAvailabilityView } from '../application/slug-availability.service';
import type { StoreCollectionDto, StoreCollectionProductListDto } from './dto';
import { withCollectionsErrors } from './error-mapping';
import { MembershipActions } from './membership-actions';
import { COLLECTION_PERMISSIONS } from './permissions';

const { view, edit } = COLLECTION_PERMISSIONS;

/** The products of a collection, the collections of a product and slug availability on the Admin API (D2314). */
@Resolver()
export class MembershipResolver {
  constructor(private readonly actions: MembershipActions) {}

  /** A page of a collection's products in collection order (D2318); not-found for any other id. */
  @Query()
  @requirePermission(view)
  storeCollectionProducts(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('options') options: unknown,
  ): Promise<StoreCollectionProductListDto> {
    return withCollectionsErrors(() => this.actions.products(ctx, id, options));
  }

  /** Whether a slug is free in the store; the edited collection's own slug is (D2319). */
  @Query()
  @requirePermission(view)
  storeCollectionSlugAvailability(
    @Ctx() ctx: RequestContext,
    @Args('slug') slug: unknown,
    @Args('collectionId') collectionId: unknown,
  ): Promise<SlugAvailabilityView> {
    return withCollectionsErrors(() => this.actions.slugAvailability(ctx, { slug, collectionId }));
  }

  /** The manual and automatic collections of a product of the store (the product editor block, D2324). */
  @Query()
  @requirePermission(view)
  storeProductCollections(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: unknown,
  ): Promise<StoreProductCollectionsView> {
    return withCollectionsErrors(() => this.actions.productCollections(ctx, productId));
  }

  /** Replaces the hand-ordered products of a manual collection (D2318). */
  @Mutation()
  @requirePermission(edit)
  setStoreCollectionProducts(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('productIds') productIds: unknown,
  ): Promise<StoreCollectionDto> {
    return withCollectionsErrors(() => this.actions.setProducts(ctx, id, { productIds }));
  }

  /** Replaces the manual collections of a product; its automatic ones stay (D2324). */
  @Mutation()
  @requirePermission(edit)
  setStoreProductCollections(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: unknown,
    @Args('collectionIds') collectionIds: unknown,
  ): Promise<StoreProductCollectionsView> {
    return withCollectionsErrors(() => this.actions.setProductCollections(ctx, productId, { collectionIds }));
  }
}
