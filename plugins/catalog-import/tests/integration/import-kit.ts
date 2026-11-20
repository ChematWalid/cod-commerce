import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformFlagsPlugin } from '@cod/plugin-platform-flags';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { PartitionedTableSchema } from '@cod/shared';
import {
  createStoreTestEnvironment,
  createTwoBusinesses,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  StoreKit,
  type TwoBusinesses,
} from '@cod/testing';
import type { VendureConfig } from '@vendure/core';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { CatalogImportPlugin } from '../../index';

export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
/** Worker id of every catalog-import test server (D2216): each file has its own database, so a repeat is harmless. */
export const IMPORT_WORKER_ID = 1017;
const APP_ENV = 'test-catalog-import';

/** A job row the isolation tests plant: which table, its store and its status. */
export interface PlantedJob {
  readonly table: 'catalog_import_job' | 'catalog_export_job';
  readonly businessId: string;
  readonly storeId: string;
  readonly status: string;
}

/** What a catalog-import suite takes from rbac: only a test file may import its entry (rule `no-cross-plugin-internals`). */
export interface ImportForeignModules {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
}

let plantedIds = 900_000_000_000;

/** The catalog-import kit: the generic store kit plus the raw seeds the job tests arrange with. */
export class ImportKit extends StoreKit {
  /** Inserts a job row as the worker or an earlier request would have left it, and returns its id. */
  async plantJob(job: PlantedJob): Promise<string> {
    plantedIds += 1;
    const id = String(plantedIds);
    const kindColumns =
      job.table === 'catalog_import_job'
        ? { names: '"kind", "format"', values: "'spreadsheet', 'csv'" }
        : { names: '"format", "scope"', values: "'csv', 'selected'" };
    await this.query(
      `INSERT INTO "${job.table}" ("id", "businessId", "storeId", "status", ${kindColumns.names}, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, ${kindColumns.values}, now(), now())`,
      [id, job.businessId, job.storeId, job.status],
    );
    return id;
  }

  /** The status and error code of a planted row, read past every tenant filter. */
  async jobRow(table: PlantedJob['table'], id: string): Promise<{ status: string; errorCode: string | null }> {
    const [row] = await this.query<{ status: string; errorCode: string | null }>(
      `SELECT "status", "errorCode" FROM "${table}" WHERE "id" = $1`,
      [id],
    );
    if (row === undefined) throw new Error(`no ${table} row ${id}`);
    return row;
  }
}

/** What a suite shares once its server booted: the kit and businesses A and B with two stores each. */
export interface ImportSuite {
  kit: ImportKit;
  fixtures: TwoBusinesses;
}

/**
 * Boots a catalog-import test server for the file: catalog and catalog-import on memory storage and the fixture
 * scraper (D2208, D2214), makes A and B, stops it after the file.
 */
export function importSuite(foreign: ImportForeignModules): ImportSuite {
  const { server, adminClient } = createStoreTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({
        redisUrl: TEST_REDIS_URL,
        platformDomain: 'localhost',
        snowflakeWorkerId: IMPORT_WORKER_ID,
      }),
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: APP_ENV }),
      PlatformOutboxPlugin,
      PlatformFlagsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: APP_ENV }),
      ...foreign.plugins,
      CatalogPlugin,
      CatalogImportPlugin.init({ objectStorage: { kind: 'memory' }, linkScraper: 'fixture', appEnv: 'test' }),
    ],
    partitionedSchemas: [...OUTBOX_SCHEMAS, ...foreign.partitionedSchemas],
    partitionMaintenance: PartitionMaintenanceService,
  });
  const suite = {} as ImportSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    suite.kit = new ImportKit(server.app, adminClient);
    suite.fixtures = await createTwoBusinesses(adminClient);
  });
  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });
  afterAll(async () => {
    await server.destroy();
  });
  return suite;
}
