import { S3Client } from '@aws-sdk/client-s3';
import { BusinessSemaphore, PlatformQueues } from '@cod/plugin-platform-jobs';
import { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { BulkEditService } from '../application/bulk-edit.service';
import type { CatalogProductsPort } from '../application/ports/catalog-products.port';
import type { JobRepositoryPort, JobScanPort } from '../application/ports/job-repository.port';
import type { ImportLogger } from '../application/ports/logger.port';
import type { ObjectStorage } from '../application/ports/object-storage.port';
import type { ProductActivityPort } from '../application/ports/product-activity.port';
import type { UnitOfWorkPort } from '../application/ports/unit-of-work.port';
import {
  CATALOG_PRODUCTS,
  IMPORT_LOGGER,
  JOB_REPOSITORY,
  JOB_SCAN,
  OBJECT_STORAGE,
  PRODUCT_ACTIVITY,
  UNIT_OF_WORK,
} from '../application/tokens';
import { CatalogProductsAdapter } from './catalog-products.adapter';
import { ImportJobsReconcileSource } from './import-jobs.reconcile-source';
import { ImportsExportsQueue } from './imports-exports.queue';
import { IMPORTS_EXPORTS_JOB_REGISTRAR, registrarOf } from './job-registrar';
import { ImportsExportsJobRegistry } from './job-registry';
import { ownRowSourceOf } from './job-row-sources';
import { JobStoreContext } from './job-store-context';
import { MemoryObjectStorage } from './memory-object-storage';
import { type CatalogImportPluginOptions, requireCatalogImportOptions, type S3StorageOptions } from './plugin-options';
import { PostgresJobScan } from './postgres-job-scan';
import { ProductActivityAdapter } from './product-activity.adapter';
import { S3ObjectStorage } from './s3-object-storage';
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

/**
 * A Garage client. Checksums only when required: the SDK's default CRC32 would be signed into a presigned PUT as the
 * checksum of an empty body, and the browser's upload would then fail it (D2250).
 */
const s3ClientAt = (options: S3StorageOptions, endpoint: string): S3Client =>
  new S3Client({
    endpoint,
    region: options.region,
    forcePathStyle: options.forcePathStyle,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

/** The object storage the options name (D2208). */
export function objectStorageOf(options: CatalogImportPluginOptions): ObjectStorage {
  const storage = options.objectStorage;
  if (storage.kind === 'memory') return new MemoryObjectStorage();
  return new S3ObjectStorage({
    client: s3ClientAt(storage, storage.endpoint),
    signingClient: s3ClientAt(storage, storage.publicEndpoint),
    bucket: storage.bucket,
  });
}

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
];
