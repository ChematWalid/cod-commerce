import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withCatalogErrors } from './error-mapping';
import { type CatalogMediaDto, type CatalogMediaListDto, MediaActions } from './media-actions';
import { MediaThrottle } from './media-throttle';
import { PRODUCT_PERMISSIONS } from './permissions';
import { scopeOf } from './store-scope-of';

const { view, edit } = PRODUCT_PERMISSIONS;

/**
 * The business's media library on the Admin API (D2113, D2132): the caller sees and deletes the images of the stores
 * it reaches; an upload belongs to the active store. Reads need `catalog.products.view`, writes `.edit`.
 */
@Resolver()
export class MediaResolver {
  constructor(
    private readonly actions: MediaActions,
    private readonly throttle: MediaThrottle,
  ) {}

  /** One page of the library, newest first. */
  @Query()
  @requirePermission(view)
  catalogMedia(@Ctx() ctx: RequestContext, @Args('options') options: unknown): Promise<CatalogMediaListDto> {
    return withCatalogErrors(() => this.actions.list(ctx, options));
  }

  /** Stores one PNG, JPEG, GIF or WebP image of at most 5 MB in the active store; rate-limited (D2138). */
  @Mutation()
  @requirePermission(edit)
  uploadCatalogMedia(@Ctx() ctx: RequestContext, @Args('file') file: unknown): Promise<CatalogMediaDto> {
    return withCatalogErrors(async () => {
      await this.throttle.spendUpload(scopeOf(ctx).businessId, String(ctx.activeUserId));
      return this.actions.upload(ctx, file);
    });
  }

  /** Deletes an image no product, variant or collection uses (D2128). */
  @Mutation()
  @requirePermission(edit)
  async deleteCatalogMedia(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withCatalogErrors(() => this.actions.delete(ctx, id));
    return true;
  }
}
