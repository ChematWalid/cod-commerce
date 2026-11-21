import { requirePermission } from '@cod/plugin-rbac/guard';
import { Controller, Get, UseFilters } from '@nestjs/common';
import { type ImportFieldView, type ImportFormatView, ListFieldsService } from '../application/list-fields.service';
import { IMPORT_REST_FILTERS } from './error-mapping';
import { IMPORT_PERMISSIONS } from './permissions';

/** The columns and formats of import and export for REST clients (D2206). */
@Controller('catalog/import-export')
@UseFilters(...IMPORT_REST_FILTERS)
export class ImportExportCatalogController {
  constructor(private readonly lists: ListFieldsService) {}

  /** The spreadsheet columns in export order, each with whether a file needs it (catalog.products.view). */
  @Get('fields')
  @requirePermission(IMPORT_PERMISSIONS.view)
  fields(): readonly ImportFieldView[] {
    return this.lists.fields();
  }

  /** The spreadsheet formats with their content type and extension (catalog.products.view). */
  @Get('formats')
  @requirePermission(IMPORT_PERMISSIONS.view)
  formats(): readonly ImportFormatView[] {
    return this.lists.formats();
  }
}
