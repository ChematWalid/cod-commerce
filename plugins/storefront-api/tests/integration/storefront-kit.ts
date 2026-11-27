import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CatalogPlugin } from '@cod/plugin-catalog';
import { CollectionsRulesPlugin } from '@cod/plugin-collections-rules';
import { OffersPlugin } from '@cod/plugin-offers';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { PartitionedTableSchema } from '@cod/shared';
import {
  type BusinessFixture,
  createPluginTestEnvironment,
  createTwoBusinesses,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
  withPartitionedSchemas,
} from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import { TransactionalConnection, type VendureConfig } from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { StorefrontApiPlugin } from '../../storefront-api.plugin';
import { SIGNED_STORE_TEST_HEADER, SignedStoreTestPlugin } from '../fixtures/signed-store.plugin';
import { aTestQuoteKeyRing } from '../support/quote-keys';
import { applySearchSchema } from '../support/search-schema';

export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
const APP_ENV = 'test-storefront-api';
const POLL_MS = 50;

/** A REST answer. */
export interface RestAnswer {
  readonly status: number;
  readonly body: unknown;
  readonly text: string;
}

/** What a test file passes from plugins outside the chain (rbac and its activity log; rule `no-cross-plugin-internals`). */
export interface StorefrontForeignModules {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
}

const CREATE_PRODUCT = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { id slug } }
}`;
const UPDATE_PRODUCT = `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { id } }
}`;
const UPDATE_STORE = `mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }`;
const CREATE_COLLECTION = `mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id slug } }`;
const SET_COLLECTION_PRODUCTS = `mutation ($id: ID!, $productIds: [ID!]!) {
  setStoreCollectionProducts(id: $id, productIds: $productIds) { id }
}`;

/** The engine id behind a GraphQL `ID` the test id strategy encodes (`T_12` → `12`), as REST carries it. */
export const rawId = (id: string): string => id.replace(/^T_/, '');

/** A product made through the catalog API: its raw id and slug. */
export interface MadeProduct {
  readonly id: string;
  readonly slug: string;
}

/** The server, its Admin API client and the arrangements the storefront tests share. */
export class StorefrontKit {
  constructor(
    readonly app: INestApplication,
    readonly client: SimpleGraphQLClient,
  ) {}

  /** Test-only direct SQL (test files are outside the data access gate). */
  query<T>(sql: string, parameters: readonly unknown[] = []): Promise<T[]> {
    return this.app.get(TransactionalConnection).rawConnection.query<T[]>(sql, [...parameters]);
  }

  /** Signs in as the business owner on `store` (its first store by default). */
  async asOwner(business: BusinessFixture, store: StoreFixture = business.stores[0]): Promise<void> {
    this.client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await this.client.asUserWithCredentials(business.owner.email, business.owner.password);
    this.client.setChannelToken(store.channelToken);
  }

  gql<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    return this.client.query<T>(gql(document), variables);
  }

  /** A product in the client's active store, active by default. */
  async product(title: string, input: Readonly<Record<string, unknown>> = {}): Promise<MadeProduct> {
    const answer = await this.gql<{ createCatalogProduct: { product: MadeProduct } }>(CREATE_PRODUCT, {
      input: { status: 'active', price: 100, title, ...input },
    });
    const { id, slug } = answer.createCatalogProduct.product;
    return { id: rawId(id), slug };
  }

  updateProduct(id: string, input: Readonly<Record<string, unknown>>): Promise<unknown> {
    return this.gql(UPDATE_PRODUCT, { id: `T_${id}`, input });
  }

  updateStore(store: StoreFixture, input: Readonly<Record<string, unknown>>): Promise<unknown> {
    return this.gql(UPDATE_STORE, { id: store.id, input });
  }

  /** A visible manual collection of the client's active store holding `productIds`. */
  async collection(slug: string, productIds: readonly string[]): Promise<string> {
    const { createStoreCollection } = await this.gql<{ createStoreCollection: { id: string } }>(CREATE_COLLECTION, {
      input: { title: slug, slug, visible: true, position: 0, mode: 'manual' },
    });
    const productRefs = productIds.map((id) => `T_${id}`);
    await this.gql(SET_COLLECTION_PRODUCTS, { id: createStoreCollection.id, productIds: productRefs });
    return rawId(createStoreCollection.id);
  }

  /** A storefront call signed for `storeId` (the stand-in of the internal signature), or unsigned without one. */
  async store(path: string, storeId?: string): Promise<RestAnswer> {
    const { port } = (this.app.getHttpServer() as Server).address() as AddressInfo;
    const headers = storeId === undefined ? undefined : { [SIGNED_STORE_TEST_HEADER]: storeId };
    const response = await fetch(`http://localhost:${String(port)}${path}`, { headers });
    const text = await response.text();
    return { status: response.status, body: text === '' ? null : (JSON.parse(text) as unknown), text };
  }

  /** Polls a signed storefront call until `accept` holds for its answer; answers it. */
  async storeUntil(path: string, storeId: string, accept: (answer: RestAnswer) => boolean): Promise<RestAnswer> {
    const deadline = Date.now() + 20_000;
    for (;;) {
      const answer = await this.store(path, storeId);
      if (accept(answer)) return answer;
      if (Date.now() > deadline) throw new Error(`the storefront never answered as expected: ${answer.text}`);
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
}

/** The ids of a product page answer, in order. */
export const idsOf = (answer: RestAnswer): string[] =>
  ((answer.body as { items?: { id: string }[] } | null)?.items ?? []).map((item) => item.id);

/** What a suite shares once its server booted. */
export interface StorefrontSuite {
  kit: StorefrontKit;
  fixtures: TwoBusinesses;
}

/** Boots a storefront-api test server for the file, makes A and B, and stops it after the file. */
export function storefrontSuite(snowflakeWorkerId: number, foreign: StorefrontForeignModules): StorefrontSuite {
  const environment = createPluginTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      PlatformOutboxPlugin,
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: APP_ENV }),
      ...foreign.plugins,
      CatalogPlugin,
      OffersPlugin.init({ quoteKeys: aTestQuoteKeyRing() }),
      CollectionsRulesPlugin,
      SignedStoreTestPlugin,
      StorefrontApiPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  const { server, adminClient } = environment;
  withPartitionedSchemas(server, [...OUTBOX_SCHEMAS, ...foreign.partitionedSchemas], PartitionMaintenanceService);
  const suite = {} as StorefrontSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await applySearchSchema(server.app);
    suite.kit = new StorefrontKit(server.app, adminClient);
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
