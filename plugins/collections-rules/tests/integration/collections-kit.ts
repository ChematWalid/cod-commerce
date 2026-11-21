import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { CatalogPlugin } from '@cod/plugin-catalog';
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
  type CredentialsFixture,
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
import { CollectionsRulesPlugin } from '../../collections-rules.plugin';
import { aTestQuoteKeyRing } from '../support/quote-keys';

export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** The jobs namespace of collections-rules test servers, apart from the catalog's. */
const APP_ENV = 'test-collections';

/** A REST answer. */
export interface RestAnswer {
  readonly status: number;
  readonly body: unknown;
  readonly text: string;
  readonly headers: Headers;
}

/**
 * What a test server takes from plugins outside the catalog chain (rbac and its partitioned activity log). Only a
 * test file may import another plugin's entry for those (rule `no-cross-plugin-internals`), so each file passes them.
 */
export interface CollectionsForeignModules {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
}

/**
 * A Vendure test server with collections-rules and what it needs: tenancy, the outbox `product.changed` and
 * `collection.changed` go through, the jobs pool of the reconcile (D2336), the throttle (D2338), the catalog and the
 * offers, whose collection targets read the membership (D2341).
 */
export function createCollectionsTestEnvironment(
  snowflakeWorkerId: number,
  foreign: CollectionsForeignModules,
): ReturnType<typeof createPluginTestEnvironment> {
  const environment = createPluginTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      PlatformOutboxPlugin,
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: APP_ENV }),
      ...foreign.plugins,
      CatalogPlugin,
      // Collections register their membership on the offers' seam (D2341), so the offers come first.
      OffersPlugin.init({ quoteKeys: aTestQuoteKeyRing() }),
      CollectionsRulesPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  withPartitionedSchemas(
    environment.server,
    [...OUTBOX_SCHEMAS, ...foreign.partitionedSchemas],
    PartitionMaintenanceService,
  );
  return environment;
}

/** The server, its Admin API client and the arrangements the collections tests share. */
export class CollectionsKit {
  constructor(
    readonly app: INestApplication,
    readonly client: SimpleGraphQLClient,
  ) {}

  private baseUrl(): string {
    const { port } = (this.app.getHttpServer() as Server).address() as AddressInfo;
    return `http://localhost:${String(port)}`;
  }

  /** Test-only direct SQL (test files are outside the data access gate). */
  query<T>(sql: string, parameters: readonly unknown[] = []): Promise<T[]> {
    return this.app.get(TransactionalConnection).rawConnection.query<T[]>(sql, [...parameters]);
  }

  /** Signs in as `credentials` and makes `store` the channel of the following calls. */
  async signIn(credentials: CredentialsFixture, store: StoreFixture): Promise<void> {
    this.client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await this.client.asUserWithCredentials(credentials.email, credentials.password);
    this.client.setChannelToken(store.channelToken);
  }

  /** Signs in as the business owner on `store` (its first store by default). */
  asOwner(business: BusinessFixture, store: StoreFixture = business.stores[0]): Promise<void> {
    return this.signIn(business.owner, store);
  }

  /** A GraphQL call with the client's session and channel. */
  gql<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    return this.client.query<T>(gql(document), variables);
  }

  /** A REST call with the client's session and channel; a body goes as JSON. */
  async rest(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<RestAnswer> {
    const init = { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    const response = await this.client.fetch(`${this.baseUrl()}${path}`, init);
    const text = await response.text();
    return {
      status: response.status,
      body: text === '' ? null : (JSON.parse(text) as unknown),
      text,
      headers: response.headers,
    };
  }
}

/** What a suite shares once its server booted: the kit and businesses A and B with two stores each. */
export interface CollectionsSuite {
  kit: CollectionsKit;
  fixtures: TwoBusinesses;
}

/** Boots a collections test server for the file, makes A and B, and stops the server after the file. */
export function collectionsSuite(snowflakeWorkerId: number, foreign: CollectionsForeignModules): CollectionsSuite {
  const { server, adminClient } = createCollectionsTestEnvironment(snowflakeWorkerId, foreign);
  const suite = {} as CollectionsSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    suite.kit = new CollectionsKit(server.app, adminClient);
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
