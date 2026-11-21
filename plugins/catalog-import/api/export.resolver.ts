import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { type ImportFieldView, type ImportFormatView, ListFieldsService } from '../application/list-fields.service';
import { withImportErrors } from './error-mapping';
import { type CatalogExportDto, ExportActions } from './export-actions';
import { IMPORT_PERMISSIONS } from './permissions';

/** Export and the import/export catalog on the Admin API; the same actions as the REST routes (D2206). */
@Resolver()
export class ExportResolver {
  constructor(
    private readonly actions: ExportActions,
    private readonly lists: ListFieldsService,
  ) {}

  /** Exports selected or filtered products of the active store to xlsx or CSV (catalog.products.view). */
  @Mutation()
  @requirePermission(IMPORT_PERMISSIONS.view)
  exportCatalogProducts(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CatalogExportDto> {
    return withImportErrors(() => this.actions.export(ctx, input));
  }

  /** An export of the active store, with a fresh download link once done (catalog.products.view). */
  @Query()
  @requirePermission(IMPORT_PERMISSIONS.view)
  catalogExport(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<CatalogExportDto> {
    return withImportErrors(() => this.actions.status(ctx, id));
  }

  /** The spreadsheet columns, in export order (catalog.products.view). */
  @Query()
  @requirePermission(IMPORT_PERMISSIONS.view)
  catalogImportFields(): readonly ImportFieldView[] {
    return this.lists.fields();
  }

  /** The spreadsheet formats (catalog.products.view). */
  @Query()
  @requirePermission(IMPORT_PERMISSIONS.view)
  catalogImportFormats(): readonly ImportFormatView[] {
    return this.lists.formats();
  }
}
