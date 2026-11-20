import { randomBytes } from 'node:crypto';
import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { type OfferInput, type QuoteRequestInput, toBusinessId, toStoreId } from '@cod/shared';
import {
  type BusinessFixture,
  createPluginTestEnvironment,
  loadPluginTestDbConfig,
  type StoreFixture,
  withPartitionedSchemas,
} from '@cod/testing';
import { ProductService, ProductVariantService, RequestContextService } from '@vendure/core';
import { OfferAdminService } from '../../application/offer-admin.service';
import type { OfferRecord } from '../../domain/offer-record';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';
import { OffersPlugin } from '../../offers.plugin';
import { aQuoteKeyRing } from '../support/quote-keys';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** The list price of the brief's worked examples. */
export const LIST_PRICE = 4_900;

/** A Vendure test server with the offers and everything they import; one snowflake worker id per file (D2433). */
export function offersTestEnvironment(
  snowflakeWorkerId: number,
  appEnv: string,
): ReturnType<typeof createPluginTestEnvironment> {
  const environment = createPluginTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      // The catalog writes `product.changed` to the outbox (D2127), whose tables are partitioned.
      PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv }),
      PlatformOutboxPlugin,
      CatalogPlugin,
      OffersPlugin.init({ quoteKeys: aQuoteKeyRing(['k1'], 'k1') }),
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  withPartitionedSchemas(environment.server, OUTBOX_SCHEMAS, PartitionMaintenanceService);
  return environment;
}

type TestServer = ReturnType<typeof createPluginTestEnvironment>['server'];

/** A context on `store`'s own channel, as the scoped pricing core is called (D2408). */
export async function storeContext(server: TestServer, store: StoreFixture): Promise<OperationContext> {
  const ctx = await server.app
    .get(RequestContextService)
    .create({ apiType: 'admin', channelOrToken: store.channelToken });
  return asOperationContext(ctx);
}

/** The scope of `business`'s `store`. */
export const scopeOf = (business: BusinessFixture, store: StoreFixture): StoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});

/** A product of one variant at {@link LIST_PRICE} in `store`'s channel. */
export async function aVariantIn(
  server: TestServer,
  store: StoreFixture,
): Promise<{ productId: string; variantId: string }> {
  const ctx = await server.app
    .get(RequestContextService)
    .create({ apiType: 'admin', channelOrToken: store.channelToken });
  const languageCode = ctx.channel.defaultLanguageCode;
  const name = `Offer product ${randomBytes(3).toString('hex')}`;
  const product = await server.app.get(ProductService).create(ctx, {
    enabled: true,
    translations: [{ languageCode, name, slug: name.toLowerCase().replaceAll(' ', '-'), description: '' }],
  });
  const [variant] = await server.app
    .get(ProductVariantService)
    .create(ctx, [{ productId: product.id, sku: name, price: LIST_PRICE, translations: [{ languageCode, name }] }]);
  if (variant === undefined) throw new Error('the variant was not created');
  return { productId: String(product.id), variantId: String(variant.id) };
}

/** Creates `input` as a draft in `store` and publishes it. */
export async function anActiveOfferIn(
  server: TestServer,
  scope: StoreScope,
  store: StoreFixture,
  input: OfferInput,
): Promise<OfferRecord> {
  const admin = server.app.get(OfferAdminService);
  const ctx = await storeContext(server, store);
  const draft = await admin.createDraft(ctx, scope, input);
  return admin.setStatus(ctx, scope, draft.id, 'active');
}

/** 10 % off from two pieces of `variantId` (the worked examples' tier). */
export const twoPieceOfferOn = (variantId: string): OfferInput => ({
  kind: 'quantity',
  title: 'Two pieces',
  config: { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] },
  targets: [{ refType: 'variant', refId: variantId }],
});

/** `percent` % off `variantId`, applied automatically or by code. */
export const productDiscountOn = (variantId: string, percent: number, method: 'automatic' | 'codes' = 'automatic') =>
  ({
    kind: 'product_discount',
    method,
    title: 'Product discount',
    config: { valueType: 'percent', value: percent, appliesTo: 'targets' },
    targets: [{ refType: 'variant', refId: variantId }],
  }) satisfies OfferInput;

/** A free add-on of `variantId` on any order of the order form (D2505). */
export const addonOfferOn = (variantId: string) =>
  ({
    kind: 'addon',
    title: 'Add-on',
    config: {
      condition: 'any_order',
      price: { mode: 'fixed', value: 0 },
      maxPiecesPerOrder: 1,
      placement: 'order_form',
    },
    targets: [{ role: 'addon', refType: 'variant', refId: variantId }],
  }) satisfies OfferInput;

/** A storefront request for `quantity` of `variantId`, home delivery to Algiers. */
export const aRequestFor = (variantId: string, quantity: number, overrides: Partial<QuoteRequestInput> = {}) =>
  ({
    channel: 'storefront',
    lines: [{ variantId, quantity }],
    destination: { provinceCode: '16', stopdesk: false },
    ...overrides,
  }) satisfies QuoteRequestInput;
