import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PartitionedTableSchema, PermissionKey } from '@cod/shared';
import { TransactionalConnection, type VendureConfig } from '@vendure/core';
import type { SimpleGraphQLClient, TestServer } from '@vendure/testing';
import gql from 'graphql-tag';
import { createMember } from './business-member';
import { createPluginTestEnvironment, PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from './create-plugin-test-environment';
import { type PartitionMaintainer, withPartitionedSchemas } from './partitioned-schema';
import { loadPluginTestDbConfig } from './plugin-test-db-config';
import type { BusinessFixture, CredentialsFixture, StoreFixture } from './two-businesses';

/** A Nest provider class, the token `app.get` takes. */
type Type<T> = abstract new (...args: never[]) => T;

const CREATE_ROLE = gql`
  mutation ($input: CreateBusinessRoleInput!) {
    createBusinessRole(input: $input) {
      id
    }
  }
`;
const SET_ACCESS = gql`
  mutation ($input: SetMemberAccessInput!) {
    setMemberAccess(input: $input) {
      administratorId
    }
  }
`;

/**
 * What a store-bound plugin test server is made of (D2216): every plugin, partitioned schema and service class is
 * the caller's, so this package depends on no `@cod/plugin-*` (that would be a workspace cycle). `plugins` is the
 * whole list in registration order (partitions, rate limit, tenancy, jobs, outbox, rbac, the plugins under test);
 * `partitionMaintenance` is `PartitionMaintenanceService`.
 */
export interface StoreTestOptions {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
  readonly partitionMaintenance: Type<PartitionMaintainer>;
}

/**
 * A Vendure test server on the compose Postgres with `options.plugins`, whose `init` also creates the partitioned
 * tables (activity log, outbox) and their current partitions (D106).
 */
export function createStoreTestEnvironment(options: StoreTestOptions): ReturnType<typeof createPluginTestEnvironment> {
  const environment = createPluginTestEnvironment({
    plugins: options.plugins,
    db: loadPluginTestDbConfig(process.env),
  });
  withPartitionedSchemas(environment.server, options.partitionedSchemas, options.partitionMaintenance);
  return environment;
}

/** A REST answer: status, parsed JSON body (`null` when empty) and the raw text. */
export interface StoreRestAnswer {
  readonly status: number;
  readonly body: unknown;
  readonly text: string;
}

/** A raw REST answer: status, headers and the body bytes. */
export interface StoreRawAnswer {
  readonly status: number;
  readonly headers: Headers;
  readonly bytes: Uint8Array;
}

/** The REST methods the kit sends. */
export type StoreRestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * The Admin API client of a store-bound plugin test and the arrangements its suites share (D2216): sign-in on a
 * store's channel, members holding a business role with exact grants, GraphQL and REST calls, and test-only SQL.
 */
export class StoreKit {
  /** Role ids by business and grant set (`roleWith`). */
  private readonly roles = new Map<string, string>();

  constructor(
    readonly app: TestServer['app'],
    readonly client: SimpleGraphQLClient,
  ) {}

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
  async rest(method: StoreRestMethod, path: string, body?: unknown): Promise<StoreRestAnswer> {
    const init = { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    const response = await this.client.fetch(`${this.baseUrl()}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: text === '' ? null : (JSON.parse(text) as unknown), text };
  }

  /** A REST call whose body and answer are bytes (an upload or a download), with the client's session and channel. */
  async restRaw(method: StoreRestMethod, path: string, body?: Uint8Array): Promise<StoreRawAnswer> {
    const response = await this.client.fetch(`${this.baseUrl()}${path}`, {
      method,
      ...(body === undefined ? {} : { body: Buffer.from(body) }),
    });
    return { status: response.status, headers: response.headers, bytes: new Uint8Array(await response.arrayBuffer()) };
  }

  /**
   * A member of the business holding a custom role with exactly `grants` on `stores` (every store when omitted),
   * granted by its owner through rbac's API; leaves the client signed in as that member on the first store given.
   */
  async signInAsMember(
    business: BusinessFixture,
    grants: readonly PermissionKey[],
    stores?: readonly StoreFixture[],
  ): Promise<CredentialsFixture> {
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
    await this.client.query(SET_ACCESS, {
      input: {
        administratorId: String(row?.id),
        roleIds,
        storeAccess: stores === undefined ? 'all' : 'selected',
        storeIds: stores?.map((store) => store.id) ?? [],
      },
    });
    await this.signIn(member, stores?.[0] ?? business.stores[0]);
    return member;
  }

  private baseUrl(): string {
    const { port } = (this.app.getHttpServer() as Server).address() as AddressInfo;
    return `http://localhost:${String(port)}`;
  }

  /** A business role holding exactly `grants`, made once per business and grant set. Runs as the owner. */
  private async roleWith(business: BusinessFixture, grants: readonly PermissionKey[]): Promise<string> {
    const key = `${business.businessId}:${[...grants].sort().join(',')}`;
    const cached = this.roles.get(key);
    if (cached !== undefined) return cached;
    const { createBusinessRole } = await this.client.query<{ createBusinessRole: { id: string } }>(CREATE_ROLE, {
      input: { name: `Role ${randomBytes(4).toString('hex')}`, grants },
    });
    this.roles.set(key, createBusinessRole.id);
    return createBusinessRole.id;
  }
}

/** The database id behind a GraphQL `ID` (the test id strategy answers `T_<id>`). */
export const rawTestId = (id: string): string => id.replace(/^T_/, '');
