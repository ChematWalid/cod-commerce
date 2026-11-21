import { BusinessSemaphore, PlatformQueues } from '@cod/plugin-platform-jobs';
import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { BulkEditService } from '../application/bulk-edit.service';
import { ExportFileBuilder } from '../application/export-file.builder';
import { ExportProductsService } from '../application/export-products.service';
import { ExportStatusService } from '../application/export-status.service';
import { ListFieldsService } from '../application/list-fields.service';
import type { CatalogExportReadsPort } from '../application/ports/catalog-export-reads.port';
import type { ExportActivityPort } from '../application/ports/export-activity.port';
import type { ExportJobStore } from '../application/ports/export-job.port';
import type { ProductOriginReads } from '../application/ports/product-origin.port';
import type { SpreadsheetFormatAdapter } from '../application/ports/spreadsheet-format.port';
import { RunExportJobService } from '../application/run-export-job.service';
import type { SpreadsheetFormatRegistry } from '../application/spreadsheet-format.registry';
import type { CatalogProductsPort } from '../application/ports/catalog-products.port';
import type { JobRepositoryPort, JobScanPort } from '../application/ports/job-repository.port';
import type { ImportLogger } from '../application/ports/logger.port';
import type { ObjectStorage } from '../application/ports/object-storage.port';
import type { ProductActivityPort } from '../application/ports/product-activity.port';
import type { UnitOfWorkPort } from '../application/ports/unit-of-work.port';
import {
  CATALOG_EXPORT_READS,
  CATALOG_PRODUCTS,
  EXPORT_JOBS,
  IMPORT_LOGGER,
  JOB_REPOSITORY,
  JOB_SCAN,
  OBJECT_STORAGE,
  PRODUCT_ACTIVITY,
  PRODUCT_ORIGINS,
  SPREADSHEET_FORMATS,
  UNIT_OF_WORK,
} from '../application/tokens';
import { CatalogExportReadsAdapter } from './catalog-export-reads.adapter';
import { ExportJobHandler } from './export-job.handler';
import { garageObjectStorage } from './garage-object-storage';
import { spreadsheetFormats } from './spreadsheet-formats';
import { TypeOrmExportJobStore } from './typeorm-export-job.store';
import { TypeOrmProductOriginReads } from './typeorm-product-origin.reads';
import { CatalogProductsAdapter } from './catalog-products.adapter';
import { IMPORT_PROVIDERS } from './import-providers';
import { ImportJobsReconcileSource } from './import-jobs.reconcile-source';
import { ImportsExportsQueue } from './imports-exports.queue';
import { IMPORTS_EXPORTS_JOB_REGISTRAR, registrarOf } from './job-registrar';
import { ImportsExportsJobRegistry } from './job-registry';
import { ownRowSourceOf } from './job-row-sources';
import { JobStoreContext } from './job-store-context';
import { LINK_IMPORT_PROVIDERS } from './link-import-providers';
import { MemoryObjectStorage } from './memory-object-storage';
import { type CatalogImportPluginOptions, requireCatalogImportOptions } from './plugin-options';
import { PostgresJobScan } from './postgres-job-scan';
import { ProductActivityAdapter } from './product-activity.adapter';
import { TenantUnitOfWork } from './tenant-unit-of-work';
import { TypeOrmJobRepository } from './typeorm-job.repository';

const LOG_CONTEXT = 'CatalogImport';

const importLogger: ImportLogger = {
  error: (message) => {
    Logger.error(message, LOG_CONTEXT);
  },
  warn: (message) => {
    Logger.warn(message, LOG_CONTEXT);
  },
};

/** The object storage the options name (D2208). */
export function objectStorageOf(options: CatalogImportPluginOptions): ObjectStorage {
  const storage = options.objectStorage;
  if (storage.kind === 'memory') return new MemoryObjectStorage();
  return garageObjectStorage(storage);
}

type Formats = SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>;

/** The export's ports, use cases and job handler (D2211). */
const EXPORT_PROVIDERS: Provider[] = [
  { provide: SPREADSHEET_FORMATS, useFactory: spreadsheetFormats },
  { provide: CATALOG_EXPORT_READS, useClass: CatalogExportReadsAdapter },
  { provide: PRODUCT_ORIGINS, useClass: TypeOrmProductOriginReads },
  { provide: EXPORT_JOBS, useClass: TypeOrmExportJobStore },
  {
    provide: ExportFileBuilder,
    useFactory: (reads: CatalogExportReadsPort, origins: ProductOriginReads, formats: Formats) =>
      new ExportFileBuilder({ reads, origins, formats }),
    inject: [CATALOG_EXPORT_READS, PRODUCT_ORIGINS, SPREADSHEET_FORMATS],
  },
  {
    provide: ExportProductsService,
    // eslint-disable-next-line max-params -- wiring: one argument per dependency the use case holds
    useFactory: (
      reads: CatalogExportReadsPort,
      files: ExportFileBuilder,
      storage: ObjectStorage,
      jobs: ExportJobStore,
      units: UnitOfWorkPort,
      activity: ExportActivityPort,
      queue: ImportsExportsQueue,
      ids: SnowflakeIdGeneratorPort,
      formats: Formats,
    ) => new ExportProductsService({ reads, files, storage, jobs, units, activity, queue, ids, formats }),
    inject: [
      CATALOG_EXPORT_READS,
      ExportFileBuilder,
      OBJECT_STORAGE,
      EXPORT_JOBS,
      UNIT_OF_WORK,
      PRODUCT_ACTIVITY,
      ImportsExportsQueue,
      SNOWFLAKE_ID_GENERATOR,
      SPREADSHEET_FORMATS,
    ],
  },
  {
    provide: ExportStatusService,
    useFactory: (jobs: ExportJobStore, storage: ObjectStorage, formats: Formats) =>
      new ExportStatusService({ jobs, storage, formats }),
    inject: [EXPORT_JOBS, OBJECT_STORAGE, SPREADSHEET_FORMATS],
  },
  {
    provide: RunExportJobService,
    // eslint-disable-next-line max-params -- wiring: one argument per dependency the use case holds
    useFactory: (
      reads: CatalogExportReadsPort,
      files: ExportFileBuilder,
      storage: ObjectStorage,
      jobs: ExportJobStore,
      units: UnitOfWorkPort,
      activity: ExportActivityPort,
    ) => new RunExportJobService({ reads, files, storage, jobs, units, activity }),
    inject: [CATALOG_EXPORT_READS, ExportFileBuilder, OBJECT_STORAGE, EXPORT_JOBS, UNIT_OF_WORK, PRODUCT_ACTIVITY],
  },
  {
    provide: ListFieldsService,
    useFactory: (formats: Formats) => new ListFieldsService(formats),
    inject: [SPREADSHEET_FORMATS],
  },
  ExportJobHandler,
];

/** Wires catalog-import's ports to their adapters, and the queue's registry, store context and reconcile source. */
export const CATALOG_IMPORT_PROVIDERS: Provider[] = [
  // Read when the app is built, not at import time: the last `init` wins (D2208).
  { provide: OBJECT_STORAGE, useFactory: () => objectStorageOf(requireCatalogImportOptions()) },
  { provide: CATALOG_PRODUCTS, useClass: CatalogProductsAdapter },
  {
    provide: JOB_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory) => new TypeOrmJobRepository(factory),
    inject: [TenantRepositoryFactory],
  },
  { provide: JOB_SCAN, useClass: PostgresJobScan },
  { provide: IMPORT_LOGGER, useValue: importLogger },
  { provide: UNIT_OF_WORK, useClass: TenantUnitOfWork },
  { provide: PRODUCT_ACTIVITY, useClass: ProductActivityAdapter },
  {
    provide: BulkEditService,
    useFactory: (catalog: CatalogProductsPort, units: UnitOfWorkPort, activity: ProductActivityPort) =>
      new BulkEditService({ catalog, units, activity }),
    inject: [CATALOG_PRODUCTS, UNIT_OF_WORK, PRODUCT_ACTIVITY],
  },
  {
    provide: JobStoreContext,
    useFactory: (catalog: CatalogProductsPort, logger: ImportLogger) => new JobStoreContext({ catalog, logger }),
    inject: [CATALOG_PRODUCTS, IMPORT_LOGGER],
  },
  {
    provide: ImportsExportsJobRegistry,
    // eslint-disable-next-line max-params -- wiring: one argument per dependency the registry holds
    useFactory: (
      semaphore: BusinessSemaphore,
      queues: PlatformQueues,
      stores: JobStoreContext,
      scan: JobScanPort,
      jobs: JobRepositoryPort,
      logger: ImportLogger,
    ) =>
      new ImportsExportsJobRegistry({
        semaphore,
        queues,
        stores,
        ownRows: (kind) => ownRowSourceOf(kind, { scan, jobs }),
        logger,
      }),
    inject: [BusinessSemaphore, PlatformQueues, JobStoreContext, JOB_SCAN, JOB_REPOSITORY, IMPORT_LOGGER],
  },
  {
    provide: IMPORTS_EXPORTS_JOB_REGISTRAR,
    useFactory: registrarOf,
    inject: [ImportsExportsJobRegistry],
  },
  {
    provide: ImportJobsReconcileSource,
    useFactory: (scan: JobScanPort, jobs: JobRepositoryPort, logger: ImportLogger) =>
      new ImportJobsReconcileSource({ scan, jobs, logger }),
    inject: [JOB_SCAN, JOB_REPOSITORY, IMPORT_LOGGER],
  },
  ImportsExportsQueue,
  ...EXPORT_PROVIDERS,
  ...IMPORT_PROVIDERS,
  ...LINK_IMPORT_PROVIDERS,
];
