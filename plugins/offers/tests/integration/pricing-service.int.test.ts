import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PricingService } from '../../application/pricing.service';
import { SHIPPING_QUOTE_REGISTRAR } from '../../application/tokens';
import { NoActiveStoreError } from '../../domain/errors';
import type { ShippingQuoteRegistrar } from '../../domain/ports/shipping-quote.port';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import {
  anActiveOfferIn,
  aRequestFor,
  aVariantIn,
  offersTestEnvironment,
  scopeOf,
  storeContext,
  twoPieceOfferOn,
} from './offers-kit';

/** One snowflake worker id per offers integration file (D2433). */
const SNOWFLAKE_WORKER_ID = 993;
/** A synthetic fee table: 800 DZD at home, 500 at a stop desk. */
const HOME_FEE = 800;
const DESK_FEE = 500;

const { server, adminClient } = offersTestEnvironment(SNOWFLAKE_WORKER_ID, 'test-offers-pricing');

let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  fixtures = await createTwoBusinesses(adminClient);
  server.app.get<symbol, ShippingQuoteRegistrar>(SHIPPING_QUOTE_REGISTRAR).register({
    quote: (_ctx, _scope, input) =>
      Promise.resolve({ resolved: true, baseFee: input.stopdesk ? DESK_FEE : HOME_FEE, overweightFee: 0, speed: null }),
  });
}, 120_000);

afterAll(async () => {
  await server.destroy();
});

describe('PricingService on a real database (D2408)', () => {
  it('quotes 5,700 for one piece and 9,620 for two with the 2-piece tier and home delivery 800', async () => {
    // Arrange
    const { a } = fixtures;
    const store = a.stores[0];
    const scope = scopeOf(a, store);
    const { variantId } = await aVariantIn(server, store);
    await anActiveOfferIn(server, scope, store, twoPieceOfferOn(variantId));
    const ctx = await storeContext(server, store);
    const pricing = server.app.get(PricingService);

    // Act
    const one = await pricing.quoteForScope(ctx, scope, aRequestFor(variantId, 1));
    const two = await pricing.quoteForScope(ctx, scope, aRequestFor(variantId, 2));
    const verdict = await pricing.verifyQuoteForScope(ctx, scope, two.quoteToken ?? '', aRequestFor(variantId, 2));

    // Assert
    expect(one).toMatchObject({ available: true, subtotal: 4_900, total: 5_700 });
    expect(two).toMatchObject({ available: true, subtotal: 8_820, total: 9_620, savings: 980 });
    expect(two.delivery).toMatchObject({ resolved: true, fee: HOME_FEE, price: HOME_FEE });
    expect(verdict.ok).toBe(true);
  });

  it('refuses a default-channel ctx as NoActiveStoreError', async () => {
    // Arrange
    const { a } = fixtures;
    const store = a.stores[0];
    const { variantId } = await aVariantIn(server, store);
    const defaultChannel = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));

    // Act
    const quoting = server.app
      .get(PricingService)
      .quoteForScope(defaultChannel, scopeOf(a, store), aRequestFor(variantId, 1));

    // Assert
    await expect(quoting).rejects.toBeInstanceOf(NoActiveStoreError);
  });
});
