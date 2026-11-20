import { randomBytes } from 'node:crypto';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { OUTBOX_SCHEMAS, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { CatalogPlugin } from '@cod/plugin-catalog';
import { toBusinessId, toStoreId } from '@cod/shared';
import {
  type BusinessFixture,
  createPluginTestEnvironment,
  createTwoBusinesses,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
  withPartitionedSchemas,
} from '@cod/testing';
import type { UpdateProductVariantInput } from '@vendure/common/lib/generated-types';
import { ProductService, ProductVariantService, type RequestContext, RequestContextService } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toCoreId } from '../../domain/core-id';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';
import { VendureVariantGate } from '../../infrastructure/variant-gate';
import { OffersPlugin } from '../../offers.plugin';
import { aQuoteKeyRing } from '../support/quote-keys';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
/** One snowflake worker id per offers integration file (D2433). */
const SNOWFLAKE_WORKER_ID = 991;
const LIST_PRICE = 4_900;

const { server, adminClient } = createPluginTestEnvironment({
  plugins: [
    PlatformPartitionsPlugin,
    RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
    TenancyPlugin.init({
      redisUrl: TEST_REDIS_URL,
      platformDomain: 'localhost',
      snowflakeWorkerId: SNOWFLAKE_WORKER_ID,
    }),
    PlatformJobsPlugin.init({ redisUrl: TEST_REDIS_URL, appEnv: 'test-offers-gate' }),
    PlatformOutboxPlugin,
    CatalogPlugin,
    OffersPlugin.init({ quoteKeys: aQuoteKeyRing(['k1'], 'k1') }),
  ],
  db: loadPluginTestDbConfig(process.env),
});
withPartitionedSchemas(server, OUTBOX_SCHEMAS, PartitionMaintenanceService);

let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  fixtures = await createTwoBusinesses(adminClient);
}, 120_000);

afterAll(async () => {
  await server.destroy();
});

/** A context on `store`'s own channel, as the scoped pricing core is called (D2408). */
const storeContext = (store: StoreFixture): Promise<RequestContext> =>
  server.app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: store.channelToken });

const scopeOf = (business: BusinessFixture, store: StoreFixture): StoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});

/** A product of one variant at {@link LIST_PRICE} in `store`'s channel; a draft is not `enabled` (D2109). */
async function aVariantIn(store: StoreFixture, enabled = true): Promise<{ productId: string; variantId: string }> {
  const ctx = await storeContext(store);
  const languageCode = ctx.channel.defaultLanguageCode;
  const name = `Gate product ${randomBytes(3).toString('hex')}`;
  const product = await server.app.get(ProductService).create(ctx, {
    enabled,
    translations: [{ languageCode, name, slug: name.toLowerCase().replaceAll(' ', '-'), description: '' }],
  });
  const [variant] = await server.app
    .get(ProductVariantService)
    .create(ctx, [{ productId: product.id, sku: name, price: LIST_PRICE, translations: [{ languageCode, name }] }]);
  if (variant === undefined) throw new Error('the variant was not created');
  return { productId: String(product.id), variantId: String(variant.id) };
}

/**
 * A variant id as Vendure's entity holds it, the integer of its SERIAL column. `ProductVariantService.update` patches the
 * loaded entity with the input id, and TypeORM takes a string `"12"` for a new row: it INSERTs without the `sku` and
 * fails (CI run 44686430717), as the catalog's own `engineIdOf` avoids.
 */
const engineId = (id: string): number => Number(id);

/** Sets `fields` on a variant of `store` through Vendure, as the catalog's editor does. */
async function editVariant(store: StoreFixture, variantId: string, fields: Omit<UpdateProductVariantInput, 'id'>) {
  await server.app
    .get(ProductVariantService)
    .update(await storeContext(store), [{ id: engineId(variantId), ...fields }]);
}

/** What the gate of `business`'s `store` accepts among `variantIds`. */
async function gateOf(business: BusinessFixture, store: StoreFixture, variantIds: readonly string[]) {
  const ctx = asOperationContext(await storeContext(store));
  return server.app.get(VendureVariantGate).accept(ctx, scopeOf(business, store), variantIds.map(toCoreId));
}

describe('VendureVariantGate (D2423)', () => {
  it('prices a variant of the active store at its list price', async () => {
    // Arrange
    const { a } = fixtures;
    const own = await aVariantIn(a.stores[0]);

    // Act
    const accepted = await gateOf(a, a.stores[0], [own.variantId]);

    // Assert
    expect(accepted.get(own.variantId)).toEqual({
      variantId: own.variantId,
      productId: own.productId,
      listPrice: LIST_PRICE,
    });
  });

  it('does not price a variant of another business', async () => {
    // Arrange
    const { a, b } = fixtures;
    const foreign = await aVariantIn(b.stores[0]);

    // Act
    const accepted = await gateOf(a, a.stores[0], [foreign.variantId]);

    // Assert
    expect(accepted.size).toBe(0);
  });

  it('does not price a variant of another store of the same business', async () => {
    // Arrange
    const { a } = fixtures;
    const sibling = await aVariantIn(a.stores[1]);

    // Act
    const accepted = await gateOf(a, a.stores[0], [sibling.variantId]);

    // Assert
    expect(accepted.size).toBe(0);
  });

  it("does not price a draft product's variant", async () => {
    // Arrange
    const { a } = fixtures;
    const draft = await aVariantIn(a.stores[0], false);

    // Act
    const accepted = await gateOf(a, a.stores[0], [draft.variantId]);

    // Assert
    expect(accepted.size).toBe(0);
  });

  it('does not price a disabled variant', async () => {
    // Arrange
    const { a } = fixtures;
    const disabled = await aVariantIn(a.stores[0]);
    await editVariant(a.stores[0], disabled.variantId, { enabled: false });

    // Act
    const accepted = await gateOf(a, a.stores[0], [disabled.variantId]);

    // Assert
    expect(accepted.size).toBe(0);
  });

  it('does not price a hidden variant', async () => {
    // Arrange
    const { a } = fixtures;
    const hidden = await aVariantIn(a.stores[0]);
    await editVariant(a.stores[0], hidden.variantId, { customFields: { isHidden: true } });

    // Act
    const accepted = await gateOf(a, a.stores[0], [hidden.variantId]);

    // Assert
    expect(accepted.size).toBe(0);
  });

  it('does not price a deleted or unknown variant', async () => {
    // Arrange
    const { a } = fixtures;
    const removed = await aVariantIn(a.stores[0]);
    await server.app.get(ProductVariantService).softDelete(await storeContext(a.stores[0]), removed.variantId);

    // Act
    const accepted = await gateOf(a, a.stores[0], [removed.variantId, '2147483000']);

    // Assert
    expect(accepted.size).toBe(0);
  });
});
