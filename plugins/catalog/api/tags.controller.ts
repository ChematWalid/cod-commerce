import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CatalogRestErrorFilter, restCall } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { TaxonomyActions } from './taxonomy-actions';
import type { CatalogNameDto } from './taxonomy-dto';

/** What a deletion answers. */
interface SuccessResult {
  readonly success: boolean;
}

/** The active store's tags for clients that do not speak GraphQL (ADR 0017, D2102). */
@Controller('catalog/tags')
@UseFilters(CatalogRestErrorFilter)
export class TagsController {
  constructor(private readonly actions: TaxonomyActions) {}

  /** The store's tags, newest first (catalog.products.view). */
  @Get()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext): Promise<CatalogNameDto[]> {
    return restCall(() => this.actions.tags.list(ctx));
  }

  /** Adds one to the store (catalog.products.edit); 201 with it. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogNameDto> {
    return restCall(() => this.actions.tags.create(ctx, body));
  }

  /** Changes one of the store (catalog.products.edit). */
  @Patch(':id')
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<CatalogNameDto> {
    return restCall(() => this.actions.tags.update(ctx, id, body));
  }

  /** Deletes one of the store (catalog.products.edit); it leaves every product. */
  @Delete(':id')
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await restCall(() => this.actions.tags.delete(ctx, id));
    return { success: true };
  }
}
