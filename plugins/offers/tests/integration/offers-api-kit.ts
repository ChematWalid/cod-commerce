import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  type BusinessFixture,
  createTwoBusinesses,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { type OffersForeignModules, offersTestEnvironment } from './offers-kit';

/** The offer fields the API tests read back. */
export const OFFER_FIELDS = `
  id kind method title status version publishedAt startsAt endsAt codeCount usageCount config
  targets { role refType refId } performance { orders deliveredRevenue discountGiven }
`;

/** An offer as the API tests read it. */
export interface OfferResult {
  readonly id: string;
  readonly kind: string;
  readonly method: string;
  readonly title: string;
  readonly status: string;
  readonly version: number;
  readonly publishedAt: string | null;
  readonly codeCount: number;
  readonly performance: { orders: number; deliveredRevenue: number; discountGiven: number };
}

/** A REST answer. */
export interface RestAnswer {
  readonly status: number;
  readonly body: unknown;
}

/** The server, its Admin API client and the calls the offers API tests share. */
export class OffersApiKit {
  constructor(
    private readonly app: INestApplication,
    readonly client: SimpleGraphQLClient,
  ) {}

  /** Test-only direct SQL (test files are outside the data access gate). */
  query<T>(sql: string, parameters: readonly unknown[] = []): Promise<T[]> {
    return this.app.get(TransactionalConnection).rawConnection.query<T[]>(sql, [...parameters]);
  }

  /** Signs in as the business owner and makes `store` (its first store by default) the channel of later calls. */
  async asOwner(business: BusinessFixture, store: StoreFixture = business.stores[0]): Promise<void> {
    this.client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await this.client.asUserWithCredentials(business.owner.email, business.owner.password);
    this.client.setChannelToken(store.channelToken);
  }

  /** A GraphQL call with the client's session and channel. */
  gql<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    return this.client.query<T>(gql(document), variables);
  }

  /** A REST call with the client's session and channel; a body goes as JSON. */
  async rest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<RestAnswer> {
    const { port } = (this.app.getHttpServer() as Server).address() as AddressInfo;
    const init = { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    const response = await this.client.fetch(`http://localhost:${String(port)}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: text === '' ? null : (JSON.parse(text) as unknown) };
  }
}

/** What a suite shares once its server booted: the kit and businesses A and B with two stores each. */
export interface OffersApiSuite {
  kit: OffersApiKit;
  fixtures: TwoBusinesses;
  server: ReturnType<typeof offersTestEnvironment>['server'];
}

/** Boots an offers test server with rbac for the file, makes A and B, and stops the server after the file. */
export function offersApiSuite(snowflakeWorkerId: number, foreign: OffersForeignModules): OffersApiSuite {
  const { server, adminClient } = offersTestEnvironment(snowflakeWorkerId, 'test-offers-api', foreign);
  const suite = { server } as OffersApiSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    suite.kit = new OffersApiKit(server.app, adminClient);
    suite.fixtures = await createTwoBusinesses(adminClient);
  }, 120_000);
  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });
  afterAll(async () => {
    await server.destroy();
  });
  return suite;
}
