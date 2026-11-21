import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withCatalogErrors } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { type CatalogSoldOutProductDto, type CatalogSoldOutProductListDto, SoldOutActions } from './sold-out-actions';

/** The active store's sold-out products and their order gating on the Admin API (AC6, D2108). */
@Resolver()
export class SoldOutResolver {
  constructor(private readonly actions: SoldOutActions) {}

  /** One page of the active store's sold-out products and whether each still takes orders (catalog.products.view). */
  @Query()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  catalogSoldOutProducts(
    @Ctx() ctx: RequestContext,
    @Args('options') options: unknown,
  ): Promise<CatalogSoldOutProductListDto> {
    return withCatalogErrors(() => this.actions.list(ctx, options));
  }

  /** Stops orders of the sold-out products named, or of every one when none is (catalog.products.edit). */
  @Mutation()
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  stopCatalogSoldOutOrders(
    @Ctx() ctx: RequestContext,
    @Args('input') input: unknown,
  ): Promise<readonly CatalogSoldOutProductDto[]> {
    return withCatalogErrors(() => this.actions.stop(ctx, input));
  }

  /** Resumes orders of the sold-out products named, or of every one when none is (catalog.products.edit). */
  @Mutation()
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  resumeCatalogSoldOutOrders(
    @Ctx() ctx: RequestContext,
    @Args('input') input: unknown,
  ): Promise<readonly CatalogSoldOutProductDto[]> {
    return withCatalogErrors(() => this.actions.resume(ctx, input));
  }
}
