import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import type {
  CatalogProductDto,
  CatalogProductListDto,
  CatalogProductSaveResultDto,
  CatalogSlugAvailabilityDto,
} from './dto';
import { withCatalogErrors } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { ProductActions } from './product-actions';

/** The store's products on the Admin API; the same actions as the REST routes. */
@Resolver()
export class ProductsResolver {
  constructor(private readonly actions: ProductActions) {}

  /** One page of the active store's products (catalog.products.view). */
  @Query()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  catalogProducts(@Ctx() ctx: RequestContext, @Args('options') options: unknown): Promise<CatalogProductListDto> {
    return withCatalogErrors(() => this.actions.list(ctx, options));
  }

  /** One product of the active store, or `null` (catalog.products.view). */
  @Query()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  catalogProduct(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<CatalogProductDto | null> {
    return withCatalogErrors(() => this.actions.get(ctx, id));
  }

  /** Whether a slug is free in the active store (catalog.products.view, D2103). */
  @Query()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  catalogSlugAvailability(
    @Ctx() ctx: RequestContext,
    @Args('slug') slug: unknown,
    @Args('productId') productId: unknown,
  ): Promise<CatalogSlugAvailabilityDto> {
    return withCatalogErrors(() => this.actions.slugAvailability(ctx, slug, productId));
  }

  /** Creates a product in the active store (catalog.products.create). */
  @Mutation()
  @requirePermission(PRODUCT_PERMISSIONS.create)
  createCatalogProduct(
    @Ctx() ctx: RequestContext,
    @Args('input') input: unknown,
  ): Promise<CatalogProductSaveResultDto> {
    return withCatalogErrors(() => this.actions.create(ctx, input));
  }

  /** Edits a product of the active store (catalog.products.edit). */
  @Mutation()
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  updateCatalogProduct(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('input') input: unknown,
  ): Promise<CatalogProductSaveResultDto> {
    return withCatalogErrors(() => this.actions.update(ctx, id, input));
  }

  /** Sets a product Active, Hidden or Draft (catalog.products.edit). */
  @Mutation()
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  setCatalogProductStatus(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('status') status: unknown,
  ): Promise<CatalogProductDto> {
    return withCatalogErrors(() => this.actions.setStatus(ctx, id, status));
  }

  /** Deletes a product of the active store (catalog.products.delete). */
  @Mutation()
  @requirePermission(PRODUCT_PERMISSIONS.delete)
  async deleteCatalogProduct(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withCatalogErrors(() => this.actions.delete(ctx, id));
    return true;
  }
}
