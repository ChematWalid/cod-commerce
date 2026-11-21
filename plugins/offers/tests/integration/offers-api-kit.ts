import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PermissionKey } from '@cod/shared';
import {
  type BusinessFixture,
  createMember,
  type CredentialsFixture,
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
import { aVariantIn, type OffersForeignModules, offersTestEnvironment, twoPieceOfferOn } from './offers-kit';
import type { TargetIds } from './registry-calls';

const CREATE_ROLE = `mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id } }`;
const SET_ACCESS = `mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId } }`;

/** The offer fields the API tests read back. */
export const OFFER_FIELDS = `
  id kind method title status version publishedAt startsAt endsAt codeCount usageCount config
  allowedMoves editable deletable
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
  readonly allowedMoves: readonly string[];
  readonly editable: boolean;
  readonly deletable: boolean;
}

/** A REST answer. */
export interface RestAnswer {
  readonly status: number;
  readonly body: unknown;
}

/** The server, its Admin API client and the calls the offers API tests share. */
export class OffersApiKit {
  /** Role ids by business and grant set (`roleWith`). */
  private readonly roles = new Map<string, string>();

  constructor(
    private readonly app: INestApplication,
    readonly client: SimpleGraphQLClient,
  ) {}

  /** Test-only direct SQL (test files are outside the data access gate). */
  query<T>(sql: string, parameters: readonly unknown[] = []): Promise<T[]> {
    return this.app.get(TransactionalConnection).rawConnection.query<T[]>(sql, [...parameters]);
  }

  /** Signs in as `credentials` and makes `store` the channel of later calls. */
  async signIn(credentials: CredentialsFixture, store: StoreFixture): Promise<void> {
    this.client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await this.client.asUserWithCredentials(credentials.email, credentials.password);
    this.client.setChannelToken(store.channelToken);
  }

  /** Signs in as the business owner and makes `store` (its first store by default) the channel of later calls. */
  asOwner(business: BusinessFixture, store: StoreFixture = business.stores[0]): Promise<void> {
    return this.signIn(business.owner, store);
  }

  /**
   * A member of the business holding a custom role with exactly `grants` on `stores` (every store when omitted),
   * granted by its owner through rbac's API; leaves the client signed in as that member on the first store given.
   */
  async signInAsMember(
    business: BusinessFixture,
    grants: readonly PermissionKey[],
    stores?: readonly StoreFixture[],
  ): Promise<void> {
    const code = `m-${randomBytes(4).toString('hex')}`;
    const member = await createMember(this.app, this.client, {
      code,
      business,
      store: business.stores[0],
      permissions: [],
    });
    const [row] = await this.query<{ id: number }>('SELECT id FROM administrator WHERE "emailAddress" = $1', [
      member.email,
    ]);
    await this.asOwner(business);
    const roleIds = grants.length === 0 ? [] : [await this.roleWith(business, grants)];
    await this.gql(SET_ACCESS, {
      input: {
        administratorId: String(row?.id),
        roleIds,
        storeAccess: stores === undefined ? 'all' : 'selected',
        storeIds: stores?.map((store) => store.id) ?? [],
      },
    });
    await this.signIn(member, stores?.[0] ?? business.stores[0]);
  }

  /**
   * A business role holding exactly `grants`, made once per business and grant set: a business may hold only so many
   * custom roles, and the permission suite signs in a member per handler. Runs as the owner.
   */
  private async roleWith(business: BusinessFixture, grants: readonly PermissionKey[]): Promise<string> {
    const key = `${business.businessId}:${[...grants].sort().join(',')}`;
    const cached = this.roles.get(key);
    if (cached !== undefined) return cached;
    const { createBusinessRole } = await this.gql<{ createBusinessRole: { id: string } }>(CREATE_ROLE, {
      input: { name: `Role ${randomBytes(4).toString('hex')}`, grants },
    });
    this.roles.set(key, createBusinessRole.id);
    return createBusinessRole.id;
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

const CREATE_WITH_CODE = `mutation ($input: CreateOfferInput!) { createOffer(input: $input) { id } }`;
const ADD_CODE = `mutation ($offerId: String!, $codes: [OfferCodeInput!]!) {
  addOfferCodes(offerId: $offerId, codes: $codes) { code }
}`;

/**
 * A draft activated by codes on a fresh variant of `store`, holding the code `code`, made by the business owner over
 * GraphQL; the ids a registry call names. Leaves the client signed in as that owner on `store`.
 */
export async function aDraftWithACode(
  suite: OffersApiSuite,
  business: BusinessFixture,
  store: StoreFixture,
  code: string,
): Promise<TargetIds> {
  const { productId, variantId } = await aVariantIn(suite.server, store);
  await suite.kit.asOwner(business, store);
  const input = { ...twoPieceOfferOn(variantId), method: 'codes' };
  const { createOffer } = await suite.kit.gql<{ createOffer: { id: string } }>(CREATE_WITH_CODE, { input });
  await suite.kit.gql(ADD_CODE, { offerId: createOffer.id, codes: [{ code }] });
  return { offerId: createOffer.id, code, productId, variantId };
}
