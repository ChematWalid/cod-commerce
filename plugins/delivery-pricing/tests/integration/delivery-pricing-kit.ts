import { GeoPlugin, GeoSeedService } from '@cod/plugin-geo';
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

/** Boots a delivery-pricing test server for the file (geo seeded), makes A and B, stops it after the file. */
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
      ...foreign.plugins,
      GeoPlugin,
      DeliveryPricingPlugin,
    ],
    partitionedSchemas: foreign.partitionedSchemas,
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
