import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import {
  SNOWFLAKE_ID_GENERATOR,
  type SnowflakeIdGeneratorPort,
  TenancyPlugin,
  TenantRepositoryFactory,
  TenantTransaction,
} from '@cod/plugin-tenancy';
import { CatalogPlugin } from '@cod/plugin-catalog';
import {
  createPluginTestEnvironment,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  withPartitionedSchemas,
} from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context.port';
import type { PricingLogger } from '../../domain/ports/pricing-logger.port';
import { OFFERS_ENTITIES } from '../../infrastructure/offers-entities';
import { SnowflakeOfferIdGenerator } from '../../infrastructure/snowflake-id.generator';
import { TypeOrmOfferCodeRepository } from '../../infrastructure/typeorm-offer-code.repository';
import { TypeOrmOfferRepository } from '../../infrastructure/typeorm-offer.repository';
import { OffersPlugin } from '../../offers.plugin';
import { describeOfferCodeRepositoryContract } from '../contract/offer-code-repository.contract';
import { describeOfferRepositoryContract, type MakeOfferHarness } from '../contract/offer-repository.contract';
import { anOfferRecord, newId, scopeA, scopeA2 } from '../support/offer-records';
import { aQuoteKeyRing } from '../support/quote-keys';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
/** One snowflake worker id per offers integration file (D2433). */
const SNOWFLAKE_WORKER_ID = 990;

const { server } = createPluginTestEnvironment({
  plugins: [
    PlatformPartitionsPlugin,
    RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
    TenancyPlugin.init({
      redisUrl: TEST_REDIS_URL,
      platformDomain: 'localhost',
      snowflakeWorkerId: SNOWFLAKE_WORKER_ID,
    }),
    // The catalog writes `product.changed` to the outbox (D2127), whose tables are partitioned.
    PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-offers' }),
    PlatformOutboxPlugin,
    CatalogPlugin,
    OffersPlugin.init({ quoteKeys: aQuoteKeyRing(['k1'], 'k1') }),
  ],
  db: loadPluginTestDbConfig(process.env),
});
withPartitionedSchemas(server, OUTBOX_SCHEMAS, PartitionMaintenanceService);

const silentLogger: PricingLogger = { unknownKind: () => undefined, unknownTarget: () => undefined };

let ctx: OperationContext;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
});

afterAll(async () => {
  await server.destroy();
});

const rawConnection = () => server.app.get(TransactionalConnection).rawConnection;

/** Each contract case starts from empty offers tables (test-only direct access, children first), on fresh adapters. */
const harness: MakeOfferHarness = async () => {
  await rawConnection().query('TRUNCATE offers_code, offers_offer_target, offers_offer');
  const factory = server.app.get(TenantRepositoryFactory);
  const transaction = server.app.get(TenantTransaction);
  const ids = new SnowflakeOfferIdGenerator(server.app.get<SnowflakeIdGeneratorPort>(SNOWFLAKE_ID_GENERATOR));
  return {
    offers: new TypeOrmOfferRepository({ repositories: factory, transaction, ids, logger: silentLogger }),
    codes: new TypeOrmOfferCodeRepository(factory, transaction),
    ctx,
  };
};

describeOfferRepositoryContract('TypeOrmOfferRepository', harness);
describeOfferCodeRepositoryContract('TypeOrmOfferCodeRepository', harness);

async function indexDefinitions(table: string): Promise<string> {
  const rows = await rawConnection().query<{ indexdef: string }[]>(
    'SELECT indexdef FROM pg_indexes WHERE tablename = $1',
    [table],
  );
  return rows.map((row) => row.indexdef).join('\n');
}

it('registers the three offers tables', () => {
  // Assert
  expect(OFFERS_ENTITIES).toHaveLength(3);
});

it('has the unique code, offer scope and status indexes (D2405, D2406)', async () => {
  // Act
  const [offer, code] = await Promise.all(['offers_offer', 'offers_code'].map(indexDefinitions));

  // Assert
  expect(offer).toMatch(/UNIQUE INDEX .*\("businessId", "storeId", id\)/);
  expect(offer).toContain('("businessId", "storeId", status)');
  expect(code).toMatch(/UNIQUE INDEX .*\("businessId", "storeId", code\)/);
});

it('refuses a store-less row and a child row of another store in Postgres itself (D2405)', async () => {
  // Arrange
  const offer = anOfferRecord();
  const { offers } = await harness();
  await offers.create(ctx, scopeA, offer);
  const insertCode = (storeId: string | null) =>
    rawConnection().query(
      'INSERT INTO offers_code (id, "businessId", "storeId", "offerId", code, "createdAt") VALUES ($1, $2, $3, $4, $5, now())',
      [newId(), scopeA.businessId, storeId, offer.id, `C${newId().slice(-8)}`],
    );

  const insertTarget = (storeId: string | null) =>
    rawConnection().query(
      'INSERT INTO offers_offer_target (id, "businessId", "storeId", "offerId", role, "refType", "refId", position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [newId(), scopeA.businessId, storeId, offer.id, 'buy', 'variant', 12, 1],
    );

  // Act
  const storeless = insertCode(null);
  const otherStore = insertCode(scopeA2.storeId);
  const storelessTarget = insertTarget(null);
  const otherStoreTarget = insertTarget(scopeA2.storeId);

  // Assert
  await expect(storeless).rejects.toThrow(/check constraint/);
  await expect(otherStore).rejects.toThrow(/foreign key constraint/);
  await expect(insertCode(scopeA.storeId)).resolves.toBeDefined();
  await expect(storelessTarget).rejects.toThrow(/check constraint/);
  await expect(otherStoreTarget).rejects.toThrow(/foreign key constraint/);
  await expect(insertTarget(scopeA.storeId)).resolves.toBeDefined();
});
