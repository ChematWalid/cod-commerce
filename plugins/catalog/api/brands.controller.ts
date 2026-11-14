import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CATALOG_REST_FILTERS, restCall } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { TaxonomyActions } from './taxonomy-actions';
import type { CatalogNameDto } from './taxonomy-dto';

/** What a deletion answers. */
interface SuccessResult {
  readonly success: boolean;
}

/** The active store's brands for clients that do not speak GraphQL (ADR 0017, D2102). */
@Controller('catalog/brands')
@UseFilters(...CATALOG_REST_FILTERS)
export class BrandsController {
  constructor(private readonly actions: TaxonomyActions) {}

  /** The store's brands, newest first (catalog.products.view). */
  @Get()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext): Promise<CatalogNameDto[]> {
    return restCall(() => this.actions.brands.list(ctx));
  }

  /** Adds one to the store (catalog.products.edit); 201 with it. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogNameDto> {
    return restCall(() => this.actions.brands.create(ctx, body));
  }

  /** Changes one of the store (catalog.products.edit). */
  @Patch(':id')
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<CatalogNameDto> {
    return restCall(() => this.actions.brands.update(ctx, id, body));
  }

  /** Deletes one of the store (catalog.products.edit); a brand is cleared from its products (D2140). */
  @Delete(':id')
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await restCall(() => this.actions.brands.delete(ctx, id));
    return { success: true };
  }
}
