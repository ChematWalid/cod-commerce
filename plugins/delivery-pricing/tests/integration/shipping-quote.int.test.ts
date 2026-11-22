import { asOperationContext as asOffersContext, PricingService } from '@cod/plugin-offers';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { type QuoteRequestInput, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { BusinessFixture, StoreFixture } from '@cod/testing';
import { ProductService, ProductVariantService, RequestContextService } from '@vendure/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  asOperationContext,
  DeliveryDefaultsConvergeService,
  type DeliveryStoreScope,
  type ShippingQuoteRequest,
  ShippingQuoteService,
} from '../../index';
import { deliveryPricingSuite, groupInput, SET_COMMUNES, UPDATE_GROUP } from './delivery-pricing-kit';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** Alger's home price in the platform default table (D3124). */
const ALGER_DEFAULT_HOME = 500;
const ALGER_CENTRE = 1601;
const ADRAR_COMMUNE = 101;
const LIST_PRICE = 4_900;

const scopeOf = (business: BusinessFixture, store: StoreFixture): DeliveryStoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(toSnowflake(store.id)),
});

const contextOn = (store: StoreFixture) =>
  suite.kit.app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: store.channelToken });

/** The delivery-pricing quote of `request` for `store`, as P3.S3 will call it. */
async function quoteIn(business: BusinessFixture, store: StoreFixture, request: Partial<ShippingQuoteRequest> = {}) {
  const ctx = asOperationContext(await contextOn(store));
  return suite.kit.app.get(ShippingQuoteService).quote(ctx, scopeOf(business, store), {
    provinceCode: '16',
    stopdesk: false,
    items: [],
    ...request,
  });
}

/** A product of one variant at {@link LIST_PRICE} in `store`'s channel, weighing `grams` when given. */
async function aProductIn(store: StoreFixture, grams?: number): Promise<{ productId: string; variantId: string }> {
  const ctx = await contextOn(store);
  const languageCode = ctx.channel.defaultLanguageCode;
  const name = `Quote product ${String(Date.now())}-${String(Math.random()).slice(2, 8)}`;
  const product = await suite.kit.app.get(ProductService).create(ctx, {
    enabled: true,
    translations: [{ languageCode, name, slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'), description: '' }],
    ...(grams === undefined ? {} : { customFields: { weight: grams } }),
  });
  const [variant] = await suite.kit.app
    .get(ProductVariantService)
    .create(ctx, [{ productId: product.id, sku: name, price: LIST_PRICE, translations: [{ languageCode, name }] }]);
  if (variant === undefined) throw new Error('the variant was not created');
  return { productId: String(product.id), variantId: String(variant.id) };
}

/** The store's default group id, as stored. */
async function defaultGroupOf(store: StoreFixture): Promise<string> {
  const [row] = await suite.kit.query<{ id: string | null }>(
    'SELECT "defaultDeliveryFeeGroupId" AS id FROM "store" WHERE id = $1',
    [store.id],
  );
  if (row?.id == null) throw new Error(`store ${store.id} has no default fee group`);
  return row.id;
}

beforeAll(async () => {
  // Every fixture store gets its default table, as `migrate` does for stores made before the hook (D3112).
  const ctx = await suite.kit.app.get(RequestContextService).create({ apiType: 'admin' });
  await suite.kit.app.get(DeliveryDefaultsConvergeService).convergeAll(asOperationContext(ctx));
});

describe('ShippingQuoteService over the stored tables (D3125)', () => {
  it("quotes the wilaya price of the store's platform default table", async () => {
    // Arrange
    const { a } = suite.fixtures;

    // Act
    const quote = await quoteIn(a, a.stores[1]);

    // Assert
    expect(quote).toMatchObject({
      resolved: true,
      baseFee: ALGER_DEFAULT_HOME,
      totalFee: ALGER_DEFAULT_HOME,
      source: 'wilaya',
      speed: 'standard',
    });
  });

  it("quotes a commune's override with its source, and refuses a commune of another wilaya", async () => {
    // Arrange
    const { a } = suite.fixtures;
    const store = a.stores[0];
    await suite.kit.asOwner(a, store);
    await suite.kit.gql(SET_COMMUNES, {
      groupId: await defaultGroupOf(store),
      provinceCode: '16',
      rows: [{ codeOns: ALGER_CENTRE, homePrice: 777, deskPrice: null, deliveryEnabled: null, deskEnabled: null }],
    });

    // Act
    const inCommune = await quoteIn(a, store, { townOns: ALGER_CENTRE });
    const elsewhere = await quoteIn(a, store, { townOns: ADRAR_COMMUNE });

    // Assert
    expect(inCommune).toMatchObject({ resolved: true, baseFee: 777, source: 'commune' });
    expect(elsewhere).toMatchObject({ resolved: false, totalFee: 0, source: null });
  });

  it("charges overweight on the catalog's product weight when the group charges it (D3119)", async () => {
    // Arrange
    const { b } = suite.fixtures;
    const store = b.stores[1];
    await suite.kit.asOwner(b, store);
    await suite.kit.gql(UPDATE_GROUP, { id: await defaultGroupOf(store), input: groupInput('Heavy', 600) });
    const { productId } = await aProductIn(store, 3500);

    // Act: two pieces of 3.5 kg are 2 kg over the 5 kg allowance, two started kilograms at 50.
    const quote = await quoteIn(b, store, { items: [{ productId, quantity: 2 }] });

    // Assert
    expect(quote).toMatchObject({ resolved: true, baseFee: 600, overweightFee: 100, totalFee: 700 });
  });
});

describe('the offers quote carries the fee (D2423)', () => {
  it("prices delivery with the store's fee table through the offers' shipping seam", async () => {
    // Arrange
    const { b } = suite.fixtures;
    const store = b.stores[0];
    const { variantId } = await aProductIn(store);
    const request = {
      channel: 'storefront',
      lines: [{ variantId, quantity: 1 }],
      destination: { provinceCode: '16', stopdesk: false },
    } satisfies QuoteRequestInput;
    const ctx = asOffersContext(await contextOn(store));

    // Act
    const quote = await suite.kit.app.get(PricingService).quoteForScope(ctx, scopeOf(b, store), request);

    // Assert
    expect(quote.delivery).toMatchObject({ resolved: true, fee: ALGER_DEFAULT_HOME, price: ALGER_DEFAULT_HOME });
    expect(quote.total).toBe(LIST_PRICE + ALGER_DEFAULT_HOME);
  });

  it('answers an unresolved delivery for a malformed commune, never the wilaya price', async () => {
    // Arrange
    const { b } = suite.fixtures;
    const store = b.stores[0];
    const { variantId } = await aProductIn(store);
    const request = {
      channel: 'storefront',
      lines: [{ variantId, quantity: 1 }],
      destination: { provinceCode: '16', townOns: '01601', stopdesk: false },
    } satisfies QuoteRequestInput;
    const ctx = asOffersContext(await contextOn(store));

    // Act
    const quote = await suite.kit.app.get(PricingService).quoteForScope(ctx, scopeOf(b, store), request);

    // Assert
    expect(quote.delivery).toMatchObject({ resolved: false, fee: 0, price: 0 });
  });
});

describe('shipping quote isolation (ADR 0002)', () => {
  it.each([
    ['business B', (fixtures: typeof suite.fixtures) => fixtures.b.stores[0]],
    ['store A2 of the same business', (fixtures: typeof suite.fixtures) => fixtures.a.stores[1]],
  ])("never reads %s's group, even when A1's store row points at it", async (_label, ownerOf) => {
    // Arrange
    const { a } = suite.fixtures;
    const store = a.stores[0];
    const ownDefault = await defaultGroupOf(store);
    const foreignGroup = await defaultGroupOf(ownerOf(suite.fixtures));
    await suite.kit.query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = $1 WHERE id = $2', [
      foreignGroup,
      store.id,
    ]);

    try {
      // Act
      const quote = await quoteIn(a, store, { townOns: ALGER_CENTRE });

      // Assert
      expect(quote).toMatchObject({ resolved: false, baseFee: 0, totalFee: 0, source: null });
    } finally {
      // A failed Act must not leave A1 pointing at a foreign group for the next tests of the file.
      await suite.kit.query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = $1 WHERE id = $2', [
        ownDefault,
        store.id,
      ]);
    }
  });
});
