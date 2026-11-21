import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { IMPORT_REST_FILTERS, restCall } from './error-mapping';
import {
  ImportActions,
  type CatalogImportDto,
  type CatalogImportPreviewDto,
  type CatalogImportUploadDto,
} from './import-actions';
import { IMPORT_PERMISSIONS } from './permissions';

/** Spreadsheet import for clients that do not speak GraphQL (ADR 0017, D2206): every step needs create (D2207). */
@Controller('catalog/import-export')
@UseFilters(...IMPORT_REST_FILTERS)
export class ImportController {
  constructor(private readonly actions: ImportActions) {}

  /** Starts an upload: 200 with the import id and the presigned PUT (exact size and type signed); 429 past the budget. */
  @Post('uploads')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.create)
  upload(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogImportUploadDto> {
    return restCall(() => this.actions.upload(ctx, body));
  }

  /**
   * Analyzes the uploaded file: 200 with its columns and row count; 400 file-type, no-header or too-many-rows, 413
   * file-too-large, 404 for another store's import, 409 before the upload; 429 past the budget.
   */
  @Post('products/analyze')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.create)
  analyze(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogImportDto> {
    return restCall(() => this.actions.analyze(ctx, body));
  }

  /** An import of the caller's store: 200, or 404 for any other id. */
  @Get('products/imports/:id')
  @requirePermission(IMPORT_PERMISSIONS.create)
  status(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<CatalogImportDto> {
    return restCall(() => this.actions.status(ctx, id));
  }

  /** A page of the stored preview (`skip`, `take` ≤ 200): 200; 404 for another store's import, 409 before a preview. */
  @Get('products/imports/:id/preview')
  @requirePermission(IMPORT_PERMISSIONS.create)
  page(@Ctx() ctx: RequestContext, @Param('id') id: string, @Query() query: unknown): Promise<CatalogImportPreviewDto> {
    return restCall(() => this.actions.page(ctx, id, query));
  }

  /** Computes the preview again, with the body's `mapping` when given: 200 with its first page; 429 past the budget. */
  @Post('products/imports/:id/preview')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.create)
  preview(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CatalogImportPreviewDto> {
    return restCall(() => this.actions.preview(ctx, id, body));
  }

  /**
   * Confirms the preview: 200 `confirming`; 403 for a create-only member when it holds updates, 409 when already
   * confirmed or the file changed, 404 for another store's import; 429 past the budget.
   */
  @Post('products/imports/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.create)
  confirm(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<CatalogImportDto> {
    return restCall(() => this.actions.confirm(ctx, id));
  }
}
