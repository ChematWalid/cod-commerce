import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import {
  SNOWFLAKE_ID_GENERATOR,
  type SnowflakeIdGeneratorPort,
  TenancyPlugin,
  TenantRepositoryFactory,
} from '@cod/plugin-tenancy';
import {
  createPluginTestEnvironment,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  withPartitionedSchemas,
} from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CatalogPlugin } from '../../catalog.plugin';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { CATALOG_ENTITIES } from '../../infrastructure/catalog-entities';
import { SnowflakeCatalogIdGenerator } from '../../infrastructure/snowflake-id.generator';
import { TypeOrmBrandRepository } from '../../infrastructure/typeorm-brand.repository';
import { TypeOrmHighlightRepository } from '../../infrastructure/typeorm-highlight.repository';
import { TypeOrmMediaRepository } from '../../infrastructure/typeorm-media.repository';
import { TypeOrmProductSettingsRepository } from '../../infrastructure/typeorm-product-settings.repository';
import { TypeOrmTagRepository } from '../../infrastructure/typeorm-tag.repository';
import { describeBrandRepositoryContract } from '../contract/brand-repository.contract';
import { describeHighlightRepositoryContract } from '../contract/highlight-repository.contract';
import { describeMediaRepositoryContract } from '../contract/media-repository.contract';
import { describeProductSettingsRepositoryContract } from '../contract/product-settings-repository.contract';
import type { MakeHarness } from '../contract/repository-harness';
import { describeTagRepositoryContract } from '../contract/tag-repository.contract';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

const { server } = createPluginTestEnvironment({
  plugins: [
    PlatformPartitionsPlugin,
    RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
    TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1020 }),
    // Catalog writes `product.changed` to the outbox (D2127), whose tables are partitioned.
    PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-catalog' }),
    PlatformOutboxPlugin,
    CatalogPlugin,
  ],
  db: loadPluginTestDbConfig(process.env),
});
withPartitionedSchemas(server, OUTBOX_SCHEMAS, PartitionMaintenanceService);

let ctx: OperationContext;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
});

afterAll(async () => {
  await server.destroy();
});

/** Each contract case starts from empty catalog tables (test-only direct access), on a fresh adapter. */
function harness<R>(build: (factory: TenantRepositoryFactory) => R): MakeHarness<R> {
  return async () => {
    const connection = server.app.get(TransactionalConnection).rawConnection;
    for (const entity of CATALOG_ENTITIES) await connection.getRepository(entity).clear();
    return { repo: build(server.app.get(TenantRepositoryFactory)), ctx };
  };
}

const ids = () => new SnowflakeCatalogIdGenerator(server.app.get<SnowflakeIdGeneratorPort>(SNOWFLAKE_ID_GENERATOR));

describeBrandRepositoryContract(
  'TypeOrmBrandRepository',
  harness((factory) => new TypeOrmBrandRepository(factory)),
);
describeTagRepositoryContract(
  'TypeOrmTagRepository',
  harness((factory) => new TypeOrmTagRepository(factory, ids())),
);
describeHighlightRepositoryContract(
  'TypeOrmHighlightRepository',
  harness((factory) => new TypeOrmHighlightRepository(factory, ids())),
);
describeProductSettingsRepositoryContract(
  'TypeOrmProductSettingsRepository',
  harness((factory) => new TypeOrmProductSettingsRepository(factory)),
);
describeMediaRepositoryContract(
  'TypeOrmMediaRepository',
  harness((factory) => new TypeOrmMediaRepository(factory)),
);

async function indexDefinitions(table: string): Promise<string> {
  const rows = await server.app
    .get(TransactionalConnection)
    .rawConnection.query<{ indexdef: string }[]>('SELECT indexdef FROM pg_indexes WHERE tablename = $1', [table]);
  return rows.map((row) => row.indexdef).join('\n');
}

it('has the unique name-key indexes and the newest-first list indexes (D2140)', async () => {
  // Act
  const [brand, tag, media] = await Promise.all(
    ['catalog_brand', 'catalog_tag', 'catalog_media'].map(indexDefinitions),
  );

  // Assert
  for (const definitions of [brand, tag]) {
    expect(definitions).toMatch(/UNIQUE INDEX .*\("businessId", "storeId", "nameKey"\)/);
    expect(definitions).toContain('("businessId", "storeId", "createdAt", id)');
  }
  expect(media).toMatch(/UNIQUE INDEX .*\("businessId", "assetId"\)/);
});

it('adds the catalog custom-field columns to the product and variant tables (D2100)', async () => {
  // Act
  const columns = await server.app
    .get(TransactionalConnection)
    .rawConnection.query<{ table_name: string; column_name: string }[]>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_name IN ('product', 'product_variant') AND column_name LIKE 'customFields%'`,
    );

  // Assert
  const names = columns.map((column) => `${column.table_name}.${column.column_name}`);
  expect(names).toEqual(
    expect.arrayContaining([
      'product.customFieldsStatus',
      'product.customFieldsBrandid',
      'product.customFieldsOldprice',
      'product_variant.customFieldsBarcode',
      'product_variant.customFieldsIshidden',
    ]),
  );
});
