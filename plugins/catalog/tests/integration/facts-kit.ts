import { toBusinessId, toStoreId } from '@cod/shared';
import {
  type BusinessFixture,
  createTwoBusinesses,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import { type RequestContext, RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { CatalogProductFactsReader, type CatalogStoreScope } from '../../index';
import { type CatalogForeignModules, CatalogKit, createCatalogTestEnvironment, rawId } from './catalog-kit';

/** What a facts suite shares once its server booted: the kit, A and B, and the exported reader. */
export interface FactsSuite {
  kit: CatalogKit;
  fixtures: TwoBusinesses;
  reader: CatalogProductFactsReader;
  app: INestApplication;
}

/**
 * Boots a catalog test server whose tests call the exported facts reader directly, as collections-rules will. The test
 * file passes rbac's module (`CatalogForeignModules`: only a test file may import another plugin's entry).
 */
export function factsSuite(snowflakeWorkerId: number, foreign: CatalogForeignModules): FactsSuite {
  const { server, adminClient } = createCatalogTestEnvironment(snowflakeWorkerId, foreign);
  const suite = {} as FactsSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    suite.app = server.app;
    suite.kit = new CatalogKit(server.app, adminClient);
    suite.fixtures = await createTwoBusinesses(adminClient);
    suite.reader = server.app.get(CatalogProductFactsReader);
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

/** The scope of `business`'s `store`. */
export const scopeOf = (business: BusinessFixture, store: StoreFixture): CatalogStoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});

/** An admin context on a channel, as a worker builds one (D2313): no request, no tenant. */
export function contextOn(suite: FactsSuite, channelToken: string): Promise<RequestContext> {
  return suite.app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: channelToken });
}

/** The default channel's context, where no store product lives (D2133). */
export const defaultContext = (suite: FactsSuite): Promise<RequestContext> =>
  contextOn(suite, PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);

/** The SQL statements a call sent: those reading a product table, and every one but transaction control. */
export interface QueryCount {
  readonly product: number;
  readonly all: number;
}

const TRANSACTION_CONTROL = /^\s*(BEGIN|START TRANSACTION|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i;

/** Runs `work` and counts the SQL statements it sent. */
export async function queriesOf(suite: FactsSuite, work: () => Promise<unknown>): Promise<QueryCount> {
  const { logger } = suite.app.get(TransactionalConnection).rawConnection;
  const original = logger.logQuery.bind(logger);
  let [product, all] = [0, 0];
  logger.logQuery = (query, parameters, runner) => {
    if (/product/i.test(query)) product += 1;
    if (!TRANSACTION_CONTROL.test(query)) all += 1;
    original(query, parameters, runner);
  };
  try {
    await work();
  } finally {
    logger.logQuery = original;
  }
  return { product, all };
}

/** The database ids of products as the API answered them. */
export const rawIds = (products: readonly { id: string }[]): string[] => products.map((product) => rawId(product.id));
