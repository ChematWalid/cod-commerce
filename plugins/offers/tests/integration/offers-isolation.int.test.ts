import type { OfferInput } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OfferAdminService } from '../../application/offer-admin.service';
import { PricingService } from '../../application/pricing.service';
import {
  anActiveOfferIn,
  aRequestFor,
  addonOfferOn,
  aVariantIn,
  LIST_PRICE,
  offersTestEnvironment,
  scopeOf,
  storeContext,
} from './offers-kit';

/** One snowflake worker id per offers integration file (D2433). */
const SNOWFLAKE_WORKER_ID = 994;
const HALF_OFF = 50;

/**
 * Half off every product of the store that holds it: an offer of another store or business cannot name A's variant
 * (D2537), so the cross-store cases use one that would match any line, A's included, if the snapshot leaked it.
 */
const storeWideHalfOff = (method: 'automatic' | 'codes' = 'automatic') =>
  ({
    kind: 'product_discount',
    method,
    title: 'Store-wide discount',
    config: { valueType: 'percent', value: HALF_OFF, appliesTo: 'all' },
  }) satisfies OfferInput;

const { server, adminClient } = offersTestEnvironment(SNOWFLAKE_WORKER_ID, 'test-offers-isolation');

let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  fixtures = await createTwoBusinesses(adminClient);
}, 120_000);

afterAll(async () => {
  await server.destroy();
});

/** A variant of business A's first store, and what quoting one piece of it there gives. */
async function quoteInA1(codes: string[] = []) {
  const { a } = fixtures;
  const store = a.stores[0];
  const { variantId } = await aVariantIn(server, store);
  const quoteOnce = async () =>
    server.app
      .get(PricingService)
      .quoteForScope(await storeContext(server, store), scopeOf(a, store), aRequestFor(variantId, 1, { codes }));
  return { variantId, quoteOnce };
}

describe('offers isolation between businesses and stores (ADR 0002)', () => {
  it('never applies an offer of business B to a quote of business A', async () => {
    // Arrange
    const { b } = fixtures;
    const { quoteOnce } = await quoteInA1();
    await anActiveOfferIn(server, scopeOf(b, b.stores[0]), b.stores[0], storeWideHalfOff());

    // Act
    const quote = await quoteOnce();

    // Assert
    expect(quote.lines[0]?.unitPrice).toBe(LIST_PRICE);
    expect(quote.applied).toEqual([]);
  });

  it('never applies an offer of store A2 to store A1', async () => {
    // Arrange
    const { a } = fixtures;
    const { quoteOnce } = await quoteInA1();
    await anActiveOfferIn(server, scopeOf(a, a.stores[1]), a.stores[1], storeWideHalfOff());

    // Act
    const quote = await quoteOnce();

    // Assert
    expect(quote.lines[0]?.unitPrice).toBe(LIST_PRICE);
    expect(quote.applied).toEqual([]);
  });

  it('rejects a code of another business as not found', async () => {
    // Arrange
    const { b } = fixtures;
    const { quoteOnce } = await quoteInA1(['iso-b-10']);
    const scopeB = scopeOf(b, b.stores[0]);
    const offer = await anActiveOfferIn(server, scopeB, b.stores[0], storeWideHalfOff('codes'));
    await server.app
      .get(OfferAdminService)
      .addCodes(await storeContext(server, b.stores[0]), scopeB, offer.id, [{ code: 'ISO-B-10' }]);

    // Act
    const quote = await quoteOnce();

    // Assert
    expect(quote.rejectedCodes).toEqual([{ code: 'ISO-B-10', reason: 'not_found' }]);
    expect(quote.lines[0]?.unitPrice).toBe(LIST_PRICE);
  });

  it('does not price a variant of another store', async () => {
    // Arrange
    const { a } = fixtures;
    const sibling = await aVariantIn(server, a.stores[1]);
    const store = a.stores[0];

    // Act
    const quote = await server.app
      .get(PricingService)
      .quoteForScope(await storeContext(server, store), scopeOf(a, store), aRequestFor(sibling.variantId, 1));

    // Assert
    expect(quote).toMatchObject({ available: false, quoteToken: null, unavailableVariantIds: [sibling.variantId] });
  });

  it('fails a token signed for store A when verified in store B', async () => {
    // Arrange
    const { a } = fixtures;
    const { variantId, quoteOnce } = await quoteInA1();
    const token = (await quoteOnce()).quoteToken ?? '';
    const otherStore = a.stores[1];

    // Act
    const verdict = await server.app
      .get(PricingService)
      .verifyQuoteForScope(
        await storeContext(server, otherStore),
        scopeOf(a, otherStore),
        token,
        aRequestFor(variantId, 1),
      );

    // Assert
    expect(verdict).toEqual({ ok: false, reason: 'store_mismatch' });
  });

  it('fails a token signed for business A when verified in business B', async () => {
    // Arrange
    const { b } = fixtures;
    const { variantId, quoteOnce } = await quoteInA1();
    const token = (await quoteOnce()).quoteToken ?? '';
    const storeB = b.stores[0];

    // Act
    const verdict = await server.app
      .get(PricingService)
      .verifyQuoteForScope(await storeContext(server, storeB), scopeOf(b, storeB), token, aRequestFor(variantId, 1));

    // Assert
    expect(verdict).toEqual({ ok: false, reason: 'business_mismatch' });
  });

  it('does not price an add-on offer of another business', async () => {
    // Arrange
    const { a, b } = fixtures;
    const store = a.stores[0];
    const { variantId } = await aVariantIn(server, store);
    const ofB = await aVariantIn(server, b.stores[0]);
    const addonOfB = await anActiveOfferIn(server, scopeOf(b, b.stores[0]), b.stores[0], addonOfferOn(ofB.variantId));
    const request = aRequestFor(variantId, 1, { addons: [{ offerId: addonOfB.id, variantId, quantity: 1 }] });

    // Act
    const quote = await server.app
      .get(PricingService)
      .quoteForScope(await storeContext(server, store), scopeOf(a, store), request);

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: addonOfB.id, variantId, reason: 'not_offered' }]);
    expect(quote.lines.map((line) => line.addonOf)).toEqual([undefined]);
    expect(quote.total).toBe(LIST_PRICE);
  });
});
