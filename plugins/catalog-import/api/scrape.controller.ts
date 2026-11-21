import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { IMPORT_REST_FILTERS, restCall } from './error-mapping';
import { type CatalogLinkImportDto, type CatalogProductPolishDto, LinkImportActions } from './link-import-actions';
import { IMPORT_PERMISSIONS } from './permissions';

/** Link import and the AI hooks for clients that do not speak GraphQL (ADR 0017, D2206, D2214, D2215). */
@Controller('catalog/scrape')
@UseFilters(...IMPORT_REST_FILTERS)
export class ScrapeController {
  constructor(private readonly actions: LinkImportActions) {}

  /**
   * Imports the body's `url` as a Draft product: 200 with the link import; 400 link-refused (private, internal or
   * unresolvable host, port, scheme, not HTML) or invalid-input, 502 link-unreachable; 429 past the budget.
   */
  @Post('import-job')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.create)
  importLink(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogLinkImportDto> {
    return restCall(() => this.actions.importLink(ctx, body));
  }

  /** A link import of the caller's store: 200, or 404 for any other id. */
  @Get('import-jobs/:id')
  @requirePermission(IMPORT_PERMISSIONS.create)
  status(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<CatalogLinkImportDto> {
    return restCall(() => this.actions.status(ctx, id));
  }

  /** The product's polished text: 200; 404 for another store's product, 409 ai-disabled; 429 past the budget. */
  @Post('products/:id/polish')
  @HttpCode(HttpStatus.OK)
  @requirePermission(IMPORT_PERMISSIONS.edit)
  polish(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<CatalogProductPolishDto> {
    return restCall(() => this.actions.polish(ctx, id));
  }
}
