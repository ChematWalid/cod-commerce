import { CatalogPlugin } from '@cod/plugin-catalog';
import { OffersPlugin } from '@cod/plugin-offers';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { PartitionedTableSchema } from '@cod/shared';
import { parseQuoteKeys, quoteKeyRing, type QuoteKeyRing } from '@cod/shared/quote-keys';
import {
  createStoreTestEnvironment,
  createTwoBusinesses,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  StoreKit,
  type TwoBusinesses,
} from '@cod/testing';
import type { VendureConfig } from '@vendure/core';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { CatalogPacksPlugin } from '../../index';

export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
/** Worker id of every pack test server (D2216): each file has its own database, so a repeat is harmless. */
export const PACKS_WORKER_ID = 1016;

/**
 * The quote keys of the offers the packs register with (D2276), read from `QUOTE_HMAC_*` like the server does: CI
 * sets them, a local run takes them from `apps/server/.env` (the P2.S4 gotcha). No key is made up here.
 */
function quoteKeysFromEnv(): QuoteKeyRing {
  const keys = process.env['QUOTE_HMAC_KEYS'];
  const activeKid = process.env['QUOTE_HMAC_ACTIVE_KID'];
  if (keys === undefined || activeKid === undefined) {
    throw new Error('the pack tests need QUOTE_HMAC_KEYS and QUOTE_HMAC_ACTIVE_KID (see .env.example)');
  }
  return quoteKeyRing(parseQuoteKeys(keys), activeKid);
}

/** The product fields the pack tests read back. */
export const PRODUCT_FIELDS = `id type status price weight optionGroups { name values { name } } variants { id price optionValues }`;
export const CREATE_PRODUCT = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { ${PRODUCT_FIELDS} } }
}`;
export const UPDATE_PRODUCT = `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { id } }
}`;
export const PRODUCT = `query ($id: ID!) { catalogProduct(id: $id) { ${PRODUCT_FIELDS} } }`;
export const PACK_FIELDS = `productId status packPricingMode packDiscountType packDiscountValue packVariantMode
  packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams`;
export const PACK = `query ($id: ID!) { catalogPack(productId: $id) { ${PACK_FIELDS} } }`;
export const SAVE_PACK = `mutation ($id: ID!, $input: CatalogPackInput!) {
  saveCatalogPack(productId: $id, input: $input) { ${PACK_FIELDS} }
}`;
export const PREVIEW_PACK = `mutation ($input: CatalogPackInput!) {
  previewCatalogPack(input: $input) { price weightGrams sharedValues { value price } }
}`;

/** A product as the pack tests read it. */
export interface ProductResult {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly price: number;
  readonly weight: number | null;
  readonly optionGroups: { name: string; values: { name: string }[] }[];
  readonly variants: { id: string; price: number; optionValues: string[] }[];
}

/** A pack as the pack tests read it. */
export interface PackResult {
  readonly productId: string;
  readonly status: string;
  readonly price: number;
  readonly weightGrams: number | null;
  readonly components: { productId: string; variantId: string | null; quantity: number }[];
}

/** The pack input of a summed, 10 % off, per-component pack of `productIds` (one each), weights summed. */
export function packInput(
  productIds: readonly string[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    packPricingMode: 'components_sum',
    packDiscountType: 'percent',
    packDiscountValue: 10,
    packVariantMode: 'per_component',
    packWeightMode: 'components_sum',
    components: productIds.map((productId) => ({ productId, quantity: 1 })),
    ...overrides,
  };
}

/** What a pack suite takes from rbac: only a test file may import its entry (rule `no-cross-plugin-internals`). */
export interface PacksForeignModules {
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly partitionedSchemas: readonly PartitionedTableSchema[];
}

/** The pack kit: the generic store kit plus the catalog calls the pack tests arrange with. */
export class PacksKit extends StoreKit {
  /** Creates a product as the signed-in caller (active, price 100 unless given) and returns it. */
  async createProduct(input: Record<string, unknown>): Promise<ProductResult> {
    const { createCatalogProduct } = await this.gql<{ createCatalogProduct: { product: ProductResult } }>(
      CREATE_PRODUCT,
      { input: { status: 'active', price: 100, ...input } },
    );
    return createCatalogProduct.product;
  }

  /** Creates a bare pack product (D2227: no options, weight or old price). */
  createPackProduct(title = 'Synthetic pack'): Promise<ProductResult> {
    return this.createProduct({ title, type: 'pack', price: 0 });
  }

  /** The product `id` as the signed-in caller reads it. */
  async product(id: string): Promise<ProductResult | null> {
    const { catalogProduct } = await this.gql<{ catalogProduct: ProductResult | null }>(PRODUCT, { id });
    return catalogProduct;
  }
}

/** What a suite shares once its server booted: the kit and businesses A and B with two stores each. */
export interface PacksSuite {
  kit: PacksKit;
  fixtures: TwoBusinesses;
}

/** Boots a pack test server for the file (catalog, offers and packs on the outbox), makes A and B, stops it after the file. */
export function packsSuite(foreign: PacksForeignModules): PacksSuite {
  const { server, adminClient } = createStoreTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: PACKS_WORKER_ID }),
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-catalog-packs' }),
      PlatformOutboxPlugin,
      ...foreign.plugins,
      CatalogPlugin,
      // The pack resolver registers with the offers' unit price registrar on bootstrap (D2276).
      OffersPlugin.init({ quoteKeys: quoteKeysFromEnv() }),
      CatalogPacksPlugin,
    ],
    partitionedSchemas: [...OUTBOX_SCHEMAS, ...foreign.partitionedSchemas],
    partitionMaintenance: PartitionMaintenanceService,
  });
  const suite = {} as PacksSuite;
  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    suite.kit = new PacksKit(server.app, adminClient);
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

/** Polls until `read` returns a value that is not undefined (the outbox drains in the background), or fails. */
export async function until<T>(read: () => Promise<T | undefined>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('the condition did not hold in time');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Waits until every event is relayed and every delivery has run, so no earlier recompute is still pending. */
export async function outboxSettled(kit: PacksKit): Promise<void> {
  await until(async () => {
    const [row] = await kit.query<{ open: string }>(
      `SELECT ((SELECT count(*) FROM outbox_event WHERE status = 'pending')
             + (SELECT count(*) FROM outbox_delivery WHERE status IN ('pending', 'enqueued')))::text AS open`,
    );
    return row?.open === '0' ? true : undefined;
  });
}
