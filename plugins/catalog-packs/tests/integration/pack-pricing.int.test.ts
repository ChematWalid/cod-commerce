import { asOperationContext, PricingService, type StoreScope } from '@cod/plugin-offers';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { type QuoteRequestInput, toBusinessId, toStoreId } from '@cod/shared';
import type { BusinessFixture, StoreFixture } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { PackUnitPriceResolver } from '../../index';
import { packInput, packsSuite, SAVE_PACK } from './packs-kit';

const suite = packsSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

/** The live price of the arranged pack: (1 500 + 2 000) − 10 %. */
const PACK_PRICE = 3150;
/** What the pack variant's stored price is set to, so a quote that reads it is caught. */
const STALE_STORED_PRICE = 1;

/** A context on `store`'s own channel, as the offers' scoped pricing core is called (D2408). */
async function storeContext(store: StoreFixture) {
  const ctx = await suite.kit.app
    .get(RequestContextService)
    .create({ apiType: 'admin', channelOrToken: store.channelToken });
  return asOperationContext(ctx);
}

const scopeOf = (business: BusinessFixture, store: StoreFixture): StoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});

/** A storefront request for one of `variantId`, home delivery to Algiers. */
const oneOf = (variantId: string): QuoteRequestInput => ({
  channel: 'storefront',
  lines: [{ variantId, quantity: 1 }],
  destination: { provinceCode: '16', stopdesk: false },
});

/** As `business`'s owner on its first store: a saved 10 % pack of a 1 500 and a 2 000 product; its variant id. */
async function aSavedPackOf(business: BusinessFixture): Promise<{ productId: string; variantId: string }> {
  await suite.kit.asOwner(business);
  const shirt = await suite.kit.createProduct({ title: 'Shirt', price: 1500, weight: 300 });
  const trousers = await suite.kit.createProduct({ title: 'Trousers', price: 2000, weight: 500 });
  const pack = await suite.kit.createPackProduct();
  await suite.kit.gql(SAVE_PACK, { id: pack.id, input: packInput([shirt.id, trousers.id]) });
  const variantId = (await suite.kit.product(pack.id))?.variants[0]?.id;
  if (variantId === undefined) throw new Error('the pack has no variant');
  await suite.kit.query('UPDATE product_variant_price SET price = $1 WHERE "variantId" = $2', [
    STALE_STORED_PRICE,
    variantId,
  ]);
  return { productId: pack.id, variantId };
}

describe('the pack resolver registered with the offers (D2204, D2276)', () => {
  it('prices a pack line through the registered pack resolver', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const { variantId } = await aSavedPackOf(a);
    const ctx = await storeContext(a.stores[0]);

    // Act
    const quote = await suite.kit.app.get(PricingService).quoteForScope(ctx, scopeOf(a, a.stores[0]), oneOf(variantId));

    // Assert: the live pack price, not the variant's stored price
    expect(quote.available).toBe(true);
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]).toMatchObject({ variantId, originalPrice: PACK_PRICE, unitPrice: PACK_PRICE });
    expect(quote.subtotal).toBe(PACK_PRICE);
  });

  it('never prices a pack of business B for business A', async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    const foreign = await aSavedPackOf(b);
    const ctx = await storeContext(a.stores[0]);
    const scopeA = scopeOf(a, a.stores[0]);

    // Act
    const quote = await suite.kit.app.get(PricingService).quoteForScope(ctx, scopeA, oneOf(foreign.variantId));
    const direct = await suite.kit.app.get(PackUnitPriceResolver).resolve(ctx, scopeA, [foreign]);

    // Assert: B's pack is unavailable to A and the resolver itself answers nothing for it in A's scope
    expect(quote.available).toBe(false);
    expect(quote.lines.find((line) => line.variantId === foreign.variantId)).toBeUndefined();
    expect(quote.unavailableVariantIds).toEqual([foreign.variantId]);
    expect(direct.size).toBe(0);
  });
});
