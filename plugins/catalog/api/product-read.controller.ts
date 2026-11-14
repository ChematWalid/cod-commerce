import { requirePermission } from '@cod/plugin-rbac/guard';
import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import type { CatalogProductDto, CatalogProductListDto, CatalogSlugAvailabilityDto } from './dto';
import { CatalogRestErrorFilter, restCall } from './error-mapping';
import { ProductNotFoundError } from '../domain/errors';
import { PRODUCT_PERMISSIONS } from './permissions';
import { ProductActions } from './product-actions';

/** The reads of the store's products for clients that do not speak GraphQL (ADR 0017). */
@Controller('catalog/products')
@UseFilters(CatalogRestErrorFilter)
export class ProductReadController {
  constructor(private readonly actions: ProductActions) {}

  /** One page of the active store's products (catalog.products.view); the query string is the list input. */
  @Get()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<CatalogProductListDto> {
    return restCall(() => this.actions.list(ctx, query));
  }

  /** Declared before `:id`, which would otherwise take `slug-availability` for a product id (D2103). */
  @Get('slug-availability')
  @requirePermission(PRODUCT_PERMISSIONS.view)
  slugAvailability(
    @Ctx() ctx: RequestContext,
    @Query('slug') slug: unknown,
    @Query('productId') productId: unknown,
  ): Promise<CatalogSlugAvailabilityDto> {
    return restCall(() => this.actions.slugAvailability(ctx, slug, productId));
  }

  /** One product of the active store (catalog.products.view); 404 `catalog.product-not-found` otherwise. */
  @Get(':id')
  @requirePermission(PRODUCT_PERMISSIONS.view)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<CatalogProductDto> {
    return restCall(async () => {
      const product = await this.actions.get(ctx, id);
      if (product === null) throw new ProductNotFoundError();
      return product;
    });
  }
}
