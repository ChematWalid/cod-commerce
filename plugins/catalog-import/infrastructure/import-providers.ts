import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { AnalyzeImportService } from '../application/analyze-import.service';
import { ConfirmImportService } from '../application/confirm-import.service';
import { CreateUploadService } from '../application/create-upload.service';
import { ImportReportService } from '../application/import-report.service';
import { ImportStatusService } from '../application/import-status.service';
import { ImportUseCases } from '../application/import-use-cases';
import type {
  CatalogImportPort,
  ImportActivityPort,
  ProductOriginWrites,
} from '../application/ports/catalog-import.port';
import type { ImportJobStore } from '../application/ports/import-job.port';
import type { ImportRowStore } from '../application/ports/import-row.port';
import type { ObjectStorage } from '../application/ports/object-storage.port';
import type { SpreadsheetFormatAdapter } from '../application/ports/spreadsheet-format.port';
import type { UnitOfWorkPort } from '../application/ports/unit-of-work.port';
import { PreviewImportService } from '../application/preview-import.service';
import { RunImportJobService } from '../application/run-import-job.service';
import type { SpreadsheetFormatRegistry } from '../application/spreadsheet-format.registry';
import {
  CATALOG_IMPORT,
  IMPORT_JOBS,
  IMPORT_ROWS,
  OBJECT_STORAGE,
  PRODUCT_ACTIVITY,
  PRODUCT_ORIGIN_WRITES,
  SPREADSHEET_FORMATS,
  UNIT_OF_WORK,
} from '../application/tokens';
import { CatalogImportAdapter } from './catalog-import.adapter';
import { ImportJobHandler } from './import-job.handler';
import { ImportsExportsQueue } from './imports-exports.queue';
import { TypeOrmProductOriginWrites } from './origin.repository';
import { TypeOrmImportJobStore } from './typeorm-import-job.store';
import { TypeOrmImportRowStore } from './typeorm-import-row.store';

type Formats = SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>;

/** The spreadsheet import's ports, use cases and job handler (D2208-D2210), beside the export's providers. */
export const IMPORT_PROVIDERS: Provider[] = [
  { provide: IMPORT_JOBS, useClass: TypeOrmImportJobStore },
  { provide: IMPORT_ROWS, useClass: TypeOrmImportRowStore },
  { provide: CATALOG_IMPORT, useClass: CatalogImportAdapter },
  { provide: PRODUCT_ORIGIN_WRITES, useClass: TypeOrmProductOriginWrites },
  {
    provide: CreateUploadService,
    useFactory: (jobs: ImportJobStore, storage: ObjectStorage, units: UnitOfWorkPort, ids: SnowflakeIdGeneratorPort) =>
      new CreateUploadService({ jobs, storage, units, ids }),
    inject: [IMPORT_JOBS, OBJECT_STORAGE, UNIT_OF_WORK, SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: AnalyzeImportService,
    useFactory: (jobs: ImportJobStore, storage: ObjectStorage, units: UnitOfWorkPort, formats: Formats) =>
      new AnalyzeImportService({ jobs, storage, units, formats }),
    inject: [IMPORT_JOBS, OBJECT_STORAGE, UNIT_OF_WORK, SPREADSHEET_FORMATS],
  },
  {
    provide: PreviewImportService,
    // eslint-disable-next-line max-params -- wiring: one argument per dependency the use case holds
    useFactory: (
      jobs: ImportJobStore,
      rows: ImportRowStore,
      catalog: CatalogImportPort,
      storage: ObjectStorage,
      units: UnitOfWorkPort,
      formats: Formats,
    ) => new PreviewImportService({ jobs, rows, catalog, storage, units, formats }),
    inject: [IMPORT_JOBS, IMPORT_ROWS, CATALOG_IMPORT, OBJECT_STORAGE, UNIT_OF_WORK, SPREADSHEET_FORMATS],
  },
  {
    provide: ConfirmImportService,
    // eslint-disable-next-line max-params -- wiring: one argument per dependency the use case holds
    useFactory: (
      jobs: ImportJobStore,
      rows: ImportRowStore,
      storage: ObjectStorage,
      queue: ImportsExportsQueue,
      formats: Formats,
    ) => new ConfirmImportService({ jobs, rows, storage, queue, formats }),
    inject: [IMPORT_JOBS, IMPORT_ROWS, OBJECT_STORAGE, ImportsExportsQueue, SPREADSHEET_FORMATS],
  },
  {
    provide: ImportStatusService,
    useFactory: (jobs: ImportJobStore, storage: ObjectStorage, formats: Formats) =>
      new ImportStatusService({ jobs, storage, formats }),
    inject: [IMPORT_JOBS, OBJECT_STORAGE, SPREADSHEET_FORMATS],
  },
  {
    provide: ImportReportService,
    useFactory: (storage: ObjectStorage, formats: Formats) => new ImportReportService({ storage, formats }),
    inject: [OBJECT_STORAGE, SPREADSHEET_FORMATS],
  },
  {
    provide: RunImportJobService,
    // eslint-disable-next-line max-params -- wiring: one argument per dependency the use case holds
    useFactory: (
      jobs: ImportJobStore,
      rows: ImportRowStore,
      catalog: CatalogImportPort,
      origins: ProductOriginWrites,
      activity: ImportActivityPort,
      report: ImportReportService,
      units: UnitOfWorkPort,
    ) => new RunImportJobService({ jobs, rows, catalog, origins, activity, report, units }),
    inject: [
      IMPORT_JOBS,
      IMPORT_ROWS,
      CATALOG_IMPORT,
      PRODUCT_ORIGIN_WRITES,
      PRODUCT_ACTIVITY,
      ImportReportService,
      UNIT_OF_WORK,
    ],
  },
  {
    provide: ImportUseCases,
    // eslint-disable-next-line max-params -- wiring: one argument per use case the API steps through
    useFactory: (
      uploads: CreateUploadService,
      analyses: AnalyzeImportService,
      previews: PreviewImportService,
      confirms: ConfirmImportService,
      statuses: ImportStatusService,
    ) => new ImportUseCases({ uploads, analyses, previews, confirms, statuses }),
    inject: [
      CreateUploadService,
      AnalyzeImportService,
      PreviewImportService,
      ConfirmImportService,
      ImportStatusService,
    ],
  },
  ImportJobHandler,
];
