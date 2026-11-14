import { requirePermission } from '@cod/plugin-rbac/guard';
import { Controller, Delete, Get, Param, Query, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CatalogRestErrorFilter, restCall } from './error-mapping';
import { type CatalogMediaListDto, MediaActions } from './media-actions';
import { PRODUCT_PERMISSIONS } from './permissions';

/** What a deletion answers. */
interface SuccessResult {
  readonly success: boolean;
}

/** The media library for clients that do not speak GraphQL (ADR 0017, D2102); uploads stay on GraphQL. */
@Controller('catalog/media')
@UseFilters(CatalogRestErrorFilter)
export class MediaController {
  constructor(private readonly actions: MediaActions) {}

  /** One page of the library, newest first (catalog.products.view); `?skip=&take=`. */
  @Get()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<CatalogMediaListDto> {
    return restCall(() => this.actions.list(ctx, query));
  }

  /** Deletes an image no product uses (catalog.products.edit, D2128). */
  @Delete(':id')
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await restCall(() => this.actions.delete(ctx, id));
    return { success: true };
  }
}
