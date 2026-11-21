import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import type { CatalogPackDto, CatalogPackPreviewDto } from './dto';
import { withPackErrors } from './error-mapping';
import { PackActions } from './pack-actions';
import { PACK_PERMISSIONS } from './permissions';

/** The store's packs on the Admin API; the same actions as the REST routes. */
@Resolver()
export class PacksResolver {
  constructor(private readonly actions: PackActions) {}

  /** The pack of a product of the active store, or `null` (catalog.products.view). */
  @Query()
  @requirePermission(PACK_PERMISSIONS.view)
  catalogPack(@Ctx() ctx: RequestContext, @Args('productId') productId: unknown): Promise<CatalogPackDto | null> {
    return withPackErrors(() => this.actions.get(ctx, productId));
  }

  /** Saves the pack of a pack product and stores its computed price and weight (catalog.products.edit). */
  @Mutation()
  @requirePermission(PACK_PERMISSIONS.edit)
  saveCatalogPack(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: unknown,
    @Args('input') input: unknown,
  ): Promise<CatalogPackDto> {
    return withPackErrors(() => this.actions.save(ctx, productId, input));
  }

  /** What a pack would cost and weigh, saving nothing; throttled per administrator (catalog.products.edit). */
  @Mutation()
  @requirePermission(PACK_PERMISSIONS.edit)
  previewCatalogPack(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CatalogPackPreviewDto> {
    return withPackErrors(() => this.actions.preview(ctx, input));
  }
}
