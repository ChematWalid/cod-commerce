import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, HttpCode, HttpStatus, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { BulkEditActions, type CatalogBulkEditResultDto } from './bulk-edit-actions';
import { IMPORT_REST_FILTERS, restCall } from './error-mapping';
import { IMPORT_PERMISSIONS } from './permissions';

/** Bulk edit for clients that do not speak GraphQL (ADR 0017, D2206). */
@Controller('catalog/products')
@UseFilters(...IMPORT_REST_FILTERS)
export class BulkEditController {
  constructor(private readonly actions: BulkEditActions) {}

  /**
   * Changes status, brand, tags or prices of selected products (catalog.products.edit): 200 with one result per
   * product, 429 past the caller's budget.
   */
  @Post('bulk-edit')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.edit)
  bulkEdit(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogBulkEditResultDto> {
    return restCall(() => this.actions.edit(ctx, body));
  }
}
