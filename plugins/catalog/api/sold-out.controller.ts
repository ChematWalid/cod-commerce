import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CATALOG_REST_FILTERS, restCall } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { type CatalogSoldOutProductDto, type CatalogSoldOutProductListDto, SoldOutActions } from './sold-out-actions';

/**
 * The sold-out products and their order gating for clients that do not speak GraphQL (ADR 0017, D2102); the body of
 * a write is `{ productIds?: string[] }`, an empty or absent list meaning every sold-out product of the store.
 */
@Controller('catalog/sold-out-products')
@UseFilters(...CATALOG_REST_FILTERS)
export class SoldOutController {
  constructor(private readonly actions: SoldOutActions) {}

  /** One page of the active store's sold-out products (catalog.products.view); `?skip=&take=`. */
  @Get()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<CatalogSoldOutProductListDto> {
    return restCall(() => this.actions.list(ctx, query));
  }

  /** Stops orders of sold-out products (catalog.products.edit); answers the products it changed. */
  @Post('stop-orders')
  @HttpCode(HttpStatus.OK)
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  stop(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<readonly CatalogSoldOutProductDto[]> {
    return restCall(() => this.actions.stop(ctx, body));
  }

  /** Resumes orders of sold-out products (catalog.products.edit); answers the products it changed. */
  @Post('resume-orders')
  @HttpCode(HttpStatus.OK)
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  resume(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<readonly CatalogSoldOutProductDto[]> {
    return restCall(() => this.actions.resume(ctx, body));
  }
}
