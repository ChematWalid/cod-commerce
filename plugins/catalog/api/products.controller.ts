import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import type { CatalogProductDto, CatalogProductSaveResultDto } from './dto';
import { CatalogRestErrorFilter, restCall } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { ProductActions } from './product-actions';
import { fieldOf } from './request-body';

/** What a deletion answers. */
interface SuccessResult {
  readonly success: boolean;
}

/** The writes of the store's products for clients that do not speak GraphQL (ADR 0017, D2102). */
@Controller('catalog/products')
@UseFilters(CatalogRestErrorFilter)
export class ProductsController {
  constructor(private readonly actions: ProductActions) {}

  /** Creates a product in the active store (catalog.products.create); 201 with the product and its warnings. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(PRODUCT_PERMISSIONS.create)
  create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogProductSaveResultDto> {
    return restCall(() => this.actions.create(ctx, body));
  }

  /** Edits a product of the active store (catalog.products.edit). */
  @Patch(':id')
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CatalogProductSaveResultDto> {
    return restCall(() => this.actions.update(ctx, id, body));
  }

  /** Sets a product Active, Hidden or Draft (catalog.products.edit); the body is `{ status }`. */
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @requirePermission(PRODUCT_PERMISSIONS.edit)
  setStatus(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<CatalogProductDto> {
    return restCall(() => this.actions.setStatus(ctx, id, fieldOf(body, 'status')));
  }

  /** Deletes a product of the active store (catalog.products.delete). */
  @Delete(':id')
  @requirePermission(PRODUCT_PERMISSIONS.delete)
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await restCall(() => this.actions.delete(ctx, id));
    return { success: true };
  }
}
