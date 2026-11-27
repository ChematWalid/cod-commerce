import { CatalogPlugin } from '@cod/plugin-catalog';
import { GeoPlugin, GeoSeedService } from '@cod/plugin-geo';
import { OffersPlugin } from '@cod/plugin-offers';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import {
  type DeliveryFeeGroupInput,
  type PartitionedTableSchema,
  toBusinessId,
  toSnowflake,
  toStoreId,
  WILAYA_CODES,
} from '@cod/shared';
import { parseQuoteKeys, quoteKeyRing, type QuoteKeyRing } from '@cod/shared/quote-keys';
import {
  type BusinessFixture,
  createStoreTestEnvironment,
  createTwoBusinesses,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  StoreKit,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService, type VendureConfig } from '@vendure/core';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { DefaultTableService, DeliveryPricingPlugin } from '../../index';
import { asOperationContext } from '../../domain/ports/operation-context';

export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
/** Worker id of every delivery-pricing test server: each file has its own database, so a repeat is harmless. */
export const DELIVERY_PRICING_WORKER_ID = 962;
const BOOT_TIMEOUT_MS = 120_000;

/**
 * The quote keys of the offers the shipping quote registers with (Task 7), read from `QUOTE_HMAC_*` like the server
 * does (copy of the packs kit): CI sets them, a local run takes them from `apps/server/.env`. No key is made up here.
 */
function quoteKeysFromEnv(): QuoteKeyRing {
  const keys = process.env['QUOTE_HMAC_KEYS'];
  const activeKid = process.env['QUOTE_HMAC_ACTIVE_KID'];
  if (keys === undefined || activeKid === undefined) {
    throw new Error('the delivery-pricing tests need QUOTE_HMAC_KEYS and QUOTE_HMAC_ACTIVE_KID (see .env.example)');
  }
  return quoteKeyRing(parseQuoteKeys(keys), activeKid);
}

export const GROUP_FIELDS = `id name carrierId chargeOverweight overweightAllowanceKg overweightRate isPlatformDefault
  createdAt updatedAt
  rates { provinceCode homePrice deskPrice baseHomePrice baseDeskPrice deliveryEnabled deskEnabled overridden }
  communeRates { codeOns provinceCode homePrice deskPrice baseHomePrice baseDeskPrice deliveryEnabled deskEnabled overridden }`;
export const LIST_GROUPS = `query ($options: DeliveryFeeGroupListInput) {
  deliveryFeeGroups(options: $options) { items { id name carrierId isPlatformDefault createdAt } totalItems }
}`;
export const GROUP = `query ($id: String!) { deliveryFeeGroup(id: $id) { ${GROUP_FIELDS} } }`;
export const CREATE_GROUP = `mutation ($input: DeliveryFeeGroupInput!) {
  createDeliveryFeeGroup(input: $input) { ${GROUP_FIELDS} }
}`;
export const UPDATE_GROUP = `mutation ($id: String!, $input: DeliveryFeeGroupInput!) {
  updateDeliveryFeeGroup(id: $id, input: $input) { ${GROUP_FIELDS} }
}`;
export const CREATE_GROUP_ID = `mutation ($input: DeliveryFeeGroupInput!) { createDeliveryFeeGroup(input: $input) { id } }`;
export const DELETE_GROUP = 'mutation ($id: String!) { deleteDeliveryFeeGroup(id: $id) }';
export const SET_COMMUNES = `mutation ($groupId: String!, $provinceCode: String!, $rows: [DeliveryFeeCommuneRateInput!]!) {
  setDeliveryFeeCommuneRates(groupId: $groupId, provinceCode: $provinceCode, rows: $rows) { ${GROUP_FIELDS} }
}`;

export const ADJUST_PRICES = `mutation ($groupId: String!, $input: DeliveryFeePriceAdjustmentInput!) {
  adjustDeliveryFeeGroupPrices(groupId: $groupId, input: $input) { ${GROUP_FIELDS} }
}`;
export const SET_COMMUNE_PRICES = `mutation ($groupId: String!, $provinceCode: String!, $input: DeliveryFeeCommunePricesInput!) {
  setDeliveryFeeProvinceCommunePrices(groupId: $groupId, provinceCode: $provinceCode, input: $input) { ${GROUP_FIELDS} }
}`;
export const DUPLICATE_GROUP = `mutation ($groupId: String!, $name: String!) {
  duplicateDeliveryFeeGroup(groupId: $groupId, name: $name) { ${GROUP_FIELDS} }
}`;

/** One wilaya row as the tests read it. */
export interface RateResult {
  readonly provinceCode: string;
  readonly homePrice: number;
  readonly deskPrice: number;
  readonly baseHomePrice: number;
  readonly baseDeskPrice: number;
  readonly deliveryEnabled: boolean;
  readonly deskEnabled: boolean;
  readonly overridden: boolean;
}

/** One commune row as the tests read it. */
export interface CommuneResult {
  readonly codeOns: number;
  readonly homePrice: number | null;
  readonly deskPrice: number | null;
  readonly baseHomePrice: number | null;
  readonly baseDeskPrice: number | null;
  readonly deliveryEnabled: boolean | null;
  readonly deskEnabled: boolean | null;
  readonly overridden: boolean;
}

/** A fee group as the tests read it. */
export interface GroupResult {
  readonly id: string;
  readonly name: string;
  readonly carrierId: string | null;
  readonly isPlatformDefault: boolean;
  readonly rates: readonly RateResult[];
  readonly communeRates: readonly CommuneResult[];
  readonly updatedAt: string;
}

/** A whole fee-group input: one rate per wilaya at `homePrice` home and 400 desk, everything enabled. */
export function groupInput(name = 'Standard', homePrice = 600): DeliveryFeeGroupInput {
  return {
    name,
    carrierId: null,
    chargeOverweight: true,
    overweightAllowanceKg: 5,
    overweightRate: 50,
    rates: WILAYA_CODES.map((provinceCode) => ({
      provinceCode,
      homePrice,
      deskPrice: 400,
      deliveryEnabled: true,
      deskEnabled: true,
    })),
  };
}

/** A commune row of the merge input. */
export const communeRow = (codeOns: number, homePrice: number | null = null): Record<string, unknown> => ({
  codeOns,
  homePrice,
  deskPrice: null,
  deliveryEnabled: null,
  deskEnabled: null,
});

/** A price adjustment of the merge input: Alger's home price raised by 10 %, communes left as they are. */
export const priceAdjustment = (fields: Record<string, unknown> = {}): Record<string, unknown> => ({
  provinceCodes: ['16'],
  kind: 'percent',
  value: 10,
  home: true,
  desk: false,
  ...fields,
});

/** The delivery-pricing kit: the generic store kit plus the fee-group calls the tests arrange with. */
export class DeliveryPricingKit extends StoreKit {
  /** Creates a group in the signed-in caller's active store. */
  async createGroup(name = 'Standard', homePrice = 600): Promise<GroupResult> {
    const { createDeliveryFeeGroup } = await this.gql<{ createDeliveryFeeGroup: GroupResult }>(CREATE_GROUP, {
      input: groupInput(name, homePrice),
    });
    return createDeliveryFeeGroup;
  }

  /** The id of `store`'s platform default group, created through the service the store hook calls (Task 6). */
  async platformDefaultOf(business: BusinessFixture, store: StoreFixture): Promise<string> {
    const ctx = await this.app
      .get(RequestContextService)
      .create({ apiType: 'admin', channelOrToken: store.channelToken });
    const scope = { businessId: toBusinessId(business.businessId), storeId: toStoreId(toSnowflake(store.id)) };
    return this.app.get(DefaultTableService).ensureFor(asOperationContext(ctx), scope);
  }

  /** The group `id` as the signed-in caller reads it. */
  async group(id: string): Promise<GroupResult | null> {
    const { deliveryFeeGroup } = await this.gql<{ deliveryFeeGroup: GroupResult | null }>(GROUP, { id });
    return deliveryFeeGroup;
  }
}

/** What a suite takes from rbac: only a test file may import its entry (rule `no-cross-plugin-internals`). */
export interface DeliveryPricingForeignModules {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
}

/** What a suite shares once its server booted: the kit and businesses A and B with two stores each. */
export interface DeliveryPricingSuite {
  kit: DeliveryPricingKit;
  fixtures: TwoBusinesses;
}

/**
 * Boots a delivery-pricing test server for the file (geo seeded; catalog and offers for the quote), makes A and B,
 * stops it after the file.
 */
export function deliveryPricingSuite(foreign: DeliveryPricingForeignModules): DeliveryPricingSuite {
  const { server, adminClient } = createStoreTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({
        redisUrl: TEST_REDIS_URL,
        platformDomain: 'localhost',
        snowflakeWorkerId: DELIVERY_PRICING_WORKER_ID,
      }),
      // The catalog writes `product.changed` to the outbox (D2127), whose tables are partitioned.
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-delivery-pricing' }),
      PlatformOutboxPlugin,
      ...foreign.plugins,
      GeoPlugin,
      CatalogPlugin,
      // The shipping quote registers with the offers' shipping quote registrar on bootstrap (Task 7).
      OffersPlugin.init({ quoteKeys: quoteKeysFromEnv() }),
      DeliveryPricingPlugin,
    ],
    partitionedSchemas: [...OUTBOX_SCHEMAS, ...foreign.partitionedSchemas],
    partitionMaintenance: PartitionMaintenanceService,
  });
  const suite = {} as DeliveryPricingSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await server.app.get(GeoSeedService).converge();
    suite.kit = new DeliveryPricingKit(server.app, adminClient);
    suite.fixtures = await createTwoBusinesses(adminClient);
  }, BOOT_TIMEOUT_MS);
  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });
  afterAll(async () => {
    await server.destroy();
  });
  return suite;
}
