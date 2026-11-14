import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CATALOG_REST_FILTERS, restCall } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { type CatalogSoldOutProductDto, SoldOutActions } from './sold-out-actions';

/**
 * The sold-out products and their order gating for clients that do not speak GraphQL (ADR 0017, D2102); the body of
 * a write is `{ productIds?: string[] }`, an empty or absent list meaning every sold-out product of the store.
 */
@Controller('catalog/sold-out-products')
@UseFilters(...CATALOG_REST_FILTERS)
export class SoldOutController {
  constructor(private readonly actions: SoldOutActions) {}

  /** Every sold-out product of the active store (catalog.products.view). */
  @Get()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext): Promise<readonly CatalogSoldOutProductDto[]> {
    return restCall(() => this.actions.list(ctx));
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
