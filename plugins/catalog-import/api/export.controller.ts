import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { IMPORT_REST_FILTERS, restCall } from './error-mapping';
import { type CatalogExportDto, ExportActions } from './export-actions';
import { IMPORT_PERMISSIONS } from './permissions';

/**
 * Export for clients that do not speak GraphQL (ADR 0017, D2206): under `catalog/`, and `POST products/export`
 * because a `GET products/export` would be shadowed by catalog's `GET products/:id`.
 */
@Controller('catalog')
@UseFilters(...IMPORT_REST_FILTERS)
export class ExportController {
  constructor(private readonly actions: ExportActions) {}

  /**
   * Exports selected or filtered products (catalog.products.view): 200 with the export, its download link when it was
   * written at once; 400 for a filter finding more than 20 000 products; 429 past the business's budget.
   */
  @Post('products/export')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.view)
  export(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogExportDto> {
    return restCall(() => this.actions.export(ctx, body));
  }

  /** An export of the caller's store (catalog.products.view): 200, or 404 for any other id. */
  @Get('import-export/exports/:id')
  @requirePermission(IMPORT_PERMISSIONS.view)
  status(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<CatalogExportDto> {
    return restCall(() => this.actions.status(ctx, id));
  }
}
