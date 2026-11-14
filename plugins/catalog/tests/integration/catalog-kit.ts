import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { PartitionedTableSchema, PermissionKey } from '@cod/shared';
import {
  type BusinessFixture,
  createMember,
  createPluginTestEnvironment,
  type CredentialsFixture,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  createTwoBusinesses,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
  withPartitionedSchemas,
} from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import {
  CollectionService,
  LanguageCode,
  RequestContextService,
  TransactionalConnection,
  type VendureConfig,
} from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll } from 'vitest';
import {
  CatalogPlugin,
  ORDER_MANAGER_CHECK_REGISTRAR,
  type OrderManagerCheck,
  type OrderManagerCheckRegistrar,
} from '../../index';

export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

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

/** The product fields every test reads back. */
export const PRODUCT_FIELDS = `
  id title slug description status price oldPrice sku barcode brandId tagIds highlightIds collectionIds label
  optionGroups { id name values { id name } }
  variants { id name sku price oldPrice barcode isHidden optionValues }
  settings { soldOut allowOutOfStockOrders isFragile orderManagerIds quantityRules { enabled min step } }
`;

export const CREATE_PRODUCT = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { warnings product { ${PRODUCT_FIELDS} } }
}`;
export const UPDATE_PRODUCT = `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { warnings product { ${PRODUCT_FIELDS} } }
}`;
export const PRODUCT = `query ($id: ID!) { catalogProduct(id: $id) { ${PRODUCT_FIELDS} } }`;
export const PRODUCTS = `query ($options: CatalogProductListInput) {
  catalogProducts(options: $options) { totalItems items { id title status } }
}`;
export const SLUG = `query ($slug: String!, $productId: ID) {
  catalogSlugAvailability(slug: $slug, productId: $productId) { available slug }
}`;

/** A product as the tests read it. */
export interface ProductResult {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: string;
  readonly price: number;
  readonly sku: string | null;
  readonly brandId: string | null;
  readonly tagIds: string[];
  readonly highlightIds: string[];
  readonly collectionIds: string[];
  readonly optionGroups: { id: string; name: string; values: { id: string; name: string }[] }[];
  readonly variants: {
    id: string;
    name: string;
    sku: string;
    price: number;
    isHidden: boolean;
    optionValues: string[];
  }[];
  readonly settings: { soldOut: boolean; allowOutOfStockOrders: boolean; orderManagerIds: string[] };
}

/** A REST answer. */
export interface RestAnswer {
  readonly status: number;
  readonly body: unknown;
  readonly text: string;
}

/**
 * A Vendure test server with the catalog and what it needs: tenancy, rbac (business roles), the outbox
 * `product.changed` goes to (D2127) and its partitioned tables (D130).
 */
/**
 * What a catalog test server takes from rbac: its module and the partitioned table it writes. Only a test file may
 * import another plugin's entry (rule `no-cross-plugin-internals`), so each test file passes them.
 */
export interface CatalogForeignModules {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
}

export function createCatalogTestEnvironment(
  snowflakeWorkerId: number,
  foreign: CatalogForeignModules,
): ReturnType<typeof createPluginTestEnvironment> {
  const environment = createPluginTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-catalog' }),
      PlatformOutboxPlugin,
      ...foreign.plugins,
      CatalogPlugin,
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

/** The server, its Admin API client and the arrangements the catalog tests share. */
export class CatalogKit {
  /** Role ids by business and grant set (`roleWith`). */
  private readonly roles = new Map<string, string>();

  constructor(
    private readonly app: INestApplication,
    readonly client: SimpleGraphQLClient,
  ) {}

  private baseUrl(): string {
    const { port } = (this.app.getHttpServer() as Server).address() as AddressInfo;
    return `http://localhost:${String(port)}`;
  }

  /** Registers a stand-in for team's order-manager check (D2114, D2132) on this server's registrar. */
  registerOrderManagerCheck(check: OrderManagerCheck): void {
    this.app.get<unknown, OrderManagerCheckRegistrar>(ORDER_MANAGER_CHECK_REGISTRAR).register(check);
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

  /** Creates a product as the signed-in caller and returns it. */
  async createProduct(input: Record<string, unknown>): Promise<ProductResult> {
    const result = await this.gql<{ createCatalogProduct: { product: ProductResult } }>(CREATE_PRODUCT, {
      input: { status: 'active', price: 100, ...input },
    });
    return result.createCatalogProduct.product;
  }

  /** A REST call with the client's session and channel; a body goes as JSON. */
  async rest(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<RestAnswer> {
    const init = { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    const response = await this.client.fetch(`${this.baseUrl()}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: text === '' ? null : (JSON.parse(text) as unknown), text };
  }

  /** A Vendure collection in `store`'s channel, as P2.S3 will make them (D2134). */
  async createCollection(store: StoreFixture, name = `Collection ${randomBytes(3).toString('hex')}`): Promise<string> {
    const ctx = await this.app
      .get(RequestContextService)
      .create({ apiType: 'admin', channelOrToken: store.channelToken });
    const collection = await this.app.get(CollectionService).create(ctx, {
      translations: [
        { languageCode: LanguageCode.ar, name, slug: name.toLowerCase().replaceAll(' ', '-'), description: '' },
      ],
      filters: [],
    });
    return String(collection.id);
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

  /**
   * A business role holding exactly `grants`, made once per business and grant set: a business may hold only so many
   * custom roles, and the permission suites sign in a member per handler. Runs as the owner.
   */
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

/** What a suite shares once its server booted: the kit and businesses A and B with two stores each. */
export interface CatalogSuite {
  kit: CatalogKit;
  fixtures: TwoBusinesses;
}

/** Boots a catalog test server for the file, makes A and B, and stops the server after the file. */
export function catalogSuite(snowflakeWorkerId: number, foreign: CatalogForeignModules): CatalogSuite {
  const { server, adminClient } = createCatalogTestEnvironment(snowflakeWorkerId, foreign);
  const suite = {} as CatalogSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    suite.kit = new CatalogKit(server.app, adminClient);
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

/** The database id behind a GraphQL `ID` (the test id strategy answers `T_<id>`). */
export const rawId = (id: string): string => id.replace(/^T_/, '');
