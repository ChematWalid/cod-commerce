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
  /** A fixed id, for tests of id order; a fresh one otherwise. */
  readonly id?: string;
}

/** What a catalog-import suite takes from rbac: only a test file may import its entry (rule `no-cross-plugin-internals`). */
export interface ImportForeignModules {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
}

let plantedIds = 900_000_000_000;

/** The product fields the bulk-edit tests read back. */
export const PRODUCT_FIELDS = 'id status price brandId tagIds variants { id price }';
const CREATE_PRODUCT = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { ${PRODUCT_FIELDS} } }
}`;
const PRODUCT = `query ($id: ID!) { catalogProduct(id: $id) { ${PRODUCT_FIELDS} } }`;

/** A product as the bulk-edit tests read it. */
export interface ProductResult {
  readonly id: string;
  readonly status: string;
  readonly price: number;
  readonly brandId: string | null;
  readonly tagIds: string[];
  readonly variants: { id: string; price: number }[];
}

/** One activity row as the bulk-edit tests read it. */
export interface ActivityRow {
  readonly businessId: string;
  readonly storeId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly actorAdministratorId: number | null;
  readonly diff: { changedFields?: string[] };
}

/** The catalog-import kit: the generic store kit plus the raw seeds the job tests arrange with. */
export class ImportKit extends StoreKit {
  /** Inserts a job row as the worker or an earlier request would have left it, and returns its id. */
  async plantJob(job: PlantedJob): Promise<string> {
    plantedIds += 1;
    const id = job.id ?? String(plantedIds);
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

  /** Creates a product as the signed-in caller (active, price 1 000 unless given) and returns it. */
  async createProduct(input: Record<string, unknown> = {}): Promise<ProductResult> {
    const { createCatalogProduct } = await this.gql<{ createCatalogProduct: { product: ProductResult } }>(
      CREATE_PRODUCT,
      { input: { title: 'Synthetic product', status: 'active', price: 1000, ...input } },
    );
    return createCatalogProduct.product;
  }

  /** The product `id` as the signed-in caller reads it, or null. */
  async product(id: string): Promise<ProductResult | null> {
    const { catalogProduct } = await this.gql<{ catalogProduct: ProductResult | null }>(PRODUCT, { id });
    return catalogProduct;
  }

  /** Creates a brand or a tag of the signed-in caller's store and returns its id. */
  async createTaxonomy(kind: 'Brand' | 'Tag', name: string): Promise<string> {
    const operation = `createCatalog${kind}`;
    const answer = await this.gql<Record<string, { id: string }>>(
      `mutation ($input: Catalog${kind}Input!) { ${operation}(input: $input) { id } }`,
      { input: { name } },
    );
    const created = answer[operation];
    if (created === undefined) throw new Error(`no ${kind} created`);
    return created.id;
  }

  /** The activity rows of one entity id, oldest first, read past every tenant filter. */
  activityOf(entityId: string): Promise<ActivityRow[]> {
    return this.query<ActivityRow>(
      `SELECT "businessId", "storeId", "action", "entityType", "entityId", "actorAdministratorId", "diff"
       FROM activity_log WHERE "entityId" = $1 ORDER BY id`,
      [entityId],
    );
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
