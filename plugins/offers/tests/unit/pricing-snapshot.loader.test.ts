import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  newBuyerHistoryRegistry,
  newCollectionMembershipRegistry,
  newOfferUsageRegistry,
  newShippingQuoteRegistry,
} from '../../application/default-sources';
import { PricingSnapshotLoader } from '../../application/pricing-snapshot.loader';
import type { SnapshotRequest } from '../../domain/ports/pricing-snapshot-source.port';
import { UNRESOLVED_SHIPPING } from '../../domain/snapshot';
import { UnitPriceRegistry } from '../../application/unit-price.registry';
import { OfferKindRegistry } from '../../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../../domain/kinds';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import type { ShippingQuoteInput } from '../../domain/ports/shipping-quote.port';
import { A_BUYER, T0 } from '../support/builders';
import { aCode, anActiveOffer, scopeA } from '../support/offer-records';
import { SELLABLE } from '../support/pricing-service';
import { FixedVariantGate } from '../fakes/fixed-variant-gate';
import { InMemoryOfferTables } from '../fakes/in-memory-offer-repository';
import { RecordingPricingLogger } from '../fakes/recording-pricing-logger';

const ctx = asOperationContext({});

/** A loader over in-memory tables and the default seams; the returned registries let a test register sources. */
function setUpLoader() {
  const tables = new InMemoryOfferTables();
  const logger = new RecordingPricingLogger();
  const seams = {
    collections: newCollectionMembershipRegistry(),
    shipping: newShippingQuoteRegistry(),
    buyers: newBuyerHistoryRegistry(),
    usage: newOfferUsageRegistry(),
  };
  const loader = new PricingSnapshotLoader({
    offers: tables.offers,
    codes: tables.codes,
    unitPrices: new UnitPriceRegistry(new FixedVariantGate(SELLABLE)),
    ...seams,
    kinds: new OfferKindRegistry(BUILT_IN_OFFER_KINDS),
    logger,
    clock: { now: () => T0 },
  });
  return { loader, tables, logger, ...seams };
}

const aSnapshotRequest = (overrides: Partial<SnapshotRequest> = {}): SnapshotRequest => ({
  lines: [{ variantId: '11', quantity: 2 }],
  destination: { provinceCode: '16', stopdesk: false },
  buyer: null,
  codes: [],
  addons: [],
  ...overrides,
});

describe('PricingSnapshotLoader', () => {
  it('prices the gated lines from the gate and lists the refused variants', async () => {
    // Arrange
    const { loader } = setUpLoader();
    const lines = [
      { variantId: '11', quantity: 2 },
      { variantId: '99', quantity: 1 },
    ];

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest({ lines }));

    // Assert
    expect(loaded.lines).toEqual([
      { key: '11', productId: '1', variantId: '11', quantity: 2, originalPrice: 4_900, collectionIds: [] },
    ]);
    expect(loaded.unavailableVariantIds).toEqual(['99']);
    expect(loaded.snapshot.now).toBe(T0);
  });

  it('logs an unknown stored kind once and leaves it out of the snapshot', async () => {
    // Arrange
    const { loader, tables, logger } = setUpLoader();
    const known = anActiveOffer();
    const unknown = anActiveOffer({ kind: 'mystery_box' });
    tables.offerRows.push({ ...scopeA, value: known }, { ...scopeA, value: unknown });

    // Act
    const first = await loader.load(ctx, scopeA, aSnapshotRequest());
    await loader.load(ctx, scopeA, aSnapshotRequest());

    // Assert
    expect(first.snapshot.offers.map((offer) => offer.id)).toEqual([known.id]);
    expect(logger.unknownKinds).toEqual([{ offerId: unknown.id, kind: 'mystery_box' }]);
  });

  it('logs a stored config its kind no longer accepts once and leaves the offer out of the snapshot (D2450)', async () => {
    // Arrange
    const { loader, tables, logger } = setUpLoader();
    const valid = anActiveOffer();
    const invalid = anActiveOffer({ config: { priceMode: 'percent', tiers: [] } });
    tables.offerRows.push({ ...scopeA, value: valid }, { ...scopeA, value: invalid });

    // Act
    const first = await loader.load(ctx, scopeA, aSnapshotRequest());
    await loader.load(ctx, scopeA, aSnapshotRequest());

    // Assert
    expect(first.snapshot.offers.map((offer) => offer.id)).toEqual([valid.id]);
    expect(logger.invalidConfigs).toEqual([{ offerId: invalid.id, kind: 'quantity' }]);
  });

  it('loads only the submitted codes of the store, by their normalised text', async () => {
    // Arrange
    const { loader, tables } = setUpLoader();
    const offer = anActiveOffer({ method: 'codes' });
    tables.offerRows.push({ ...scopeA, value: offer });
    tables.codeRows.push(
      { ...scopeA, value: aCode(offer.id, 'INFLU10', { usageLimit: 5, usageCount: 2 }) },
      { ...scopeA, value: aCode(offer.id, 'OTHER') },
    );

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest({ codes: [' influ10 '] }));

    // Assert
    expect([...loaded.snapshot.codes]).toEqual([['INFLU10', { offerId: offer.id, usageLimit: 5, usageCount: 2 }]]);
  });

  it('asks no shipping source without a destination and leaves delivery unresolved', async () => {
    // Arrange
    const { loader, shipping } = setUpLoader();
    const asked: ShippingQuoteInput[] = [];
    shipping.register({
      quote: (_ctx, _scope, input) => {
        asked.push(input);
        return Promise.resolve({ resolved: true, baseFee: 800, overweightFee: 0, speed: null });
      },
    });

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest({ destination: null }));

    // Assert
    expect(asked).toEqual([]);
    expect(loaded.snapshot.shipping).toBe(UNRESOLVED_SHIPPING);
  });

  it('quotes delivery for the gated lines only', async () => {
    // Arrange
    const { loader, shipping } = setUpLoader();
    const asked: ShippingQuoteInput[] = [];
    shipping.register({
      quote: (_ctx, _scope, input) => {
        asked.push(input);
        return Promise.resolve({ resolved: true, baseFee: 800, overweightFee: 0, speed: null });
      },
    });
    const lines = [
      { variantId: '11', quantity: 2 },
      { variantId: '99', quantity: 1 },
    ];

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest({ lines }));

    // Assert
    expect(asked).toEqual([
      { provinceCode: '16', stopdesk: false, items: [{ productId: '1', variantId: '11', quantity: 2 }] },
    ]);
    expect(loaded.snapshot.shipping.baseFee).toBe(800);
  });

  it("puts each line in its product's collections", async () => {
    // Arrange
    const { loader, collections } = setUpLoader();
    collections.register({
      collectionsOf: () => Promise.resolve(new Map([['1', ['31', '32']]])),
      existingCollectionIds: (_ctx, _scope, ids) => Promise.resolve(ids),
    });

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest());

    // Assert
    expect(loaded.lines[0]?.collectionIds).toEqual(['31', '32']);
  });

  it('reads no buyer history or usage without a phone', async () => {
    // Arrange
    const { loader, tables } = setUpLoader();
    tables.offerRows.push({ ...scopeA, value: anActiveOffer({ perBuyerLimit: 1 }) });

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest());

    // Assert
    expect(loaded.snapshot.buyerOrderCount).toBeNull();
    expect(loaded.snapshot.perBuyerUsage.size).toBe(0);
  });

  it("reads the buyer's order count and uses of the per-buyer limited offers", async () => {
    // Arrange
    const { loader, tables, buyers, usage } = setUpLoader();
    const limited = anActiveOffer({ perBuyerLimit: 1 });
    tables.offerRows.push({ ...scopeA, value: limited }, { ...scopeA, value: anActiveOffer() });
    const askedFor: (readonly string[])[] = [];
    buyers.register({ orderCountOf: () => Promise.resolve(3) });
    usage.register({
      perBuyer: (_ctx, _scope, offerIds) => {
        askedFor.push(offerIds);
        return Promise.resolve(new Map([[limited.id, 1]]));
      },
    });

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest({ buyer: A_BUYER }));

    // Assert
    expect(loaded.snapshot.buyerOrderCount).toBe(3);
    expect(askedFor).toEqual([[limited.id]]);
    expect(loaded.snapshot.perBuyerUsage.get(limited.id)).toBe(1);
  });
});

describe('PricingSnapshotLoader: add-ons (D2506)', () => {
  const ADDON_OFFER_ID = toSnowflake('7006');

  it('prices add-on variants through the gate and keeps a refused one unpriced', async () => {
    // Arrange
    const { loader } = setUpLoader();
    const addons = [
      { offerId: ADDON_OFFER_ID, variantId: '12', quantity: 2 },
      { offerId: ADDON_OFFER_ID, variantId: '99', quantity: 1 },
    ];

    // Act
    const loaded = await loader.load(ctx, scopeA, aSnapshotRequest({ addons }));

    // Assert
    expect(loaded.addons).toEqual([
      {
        offerId: '7006',
        variantId: '12',
        quantity: 2,
        priced: { productId: '2', originalPrice: 3_000, collectionIds: [] },
      },
      { offerId: '7006', variantId: '99', quantity: 1, priced: null },
    ]);
    expect(loaded.unavailableVariantIds).toEqual([]);
  });

  it('quotes delivery for the cart lines only, never for the add-ons', async () => {
    // Arrange
    const { loader, shipping } = setUpLoader();
    const asked: ShippingQuoteInput[] = [];
    shipping.register({
      quote: (_ctx, _scope, input) => {
        asked.push(input);
        return Promise.resolve({ resolved: true, baseFee: 800, overweightFee: 0, speed: null });
      },
    });
    const addons = [{ offerId: ADDON_OFFER_ID, variantId: '12', quantity: 1 }];

    // Act
    await loader.load(ctx, scopeA, aSnapshotRequest({ addons }));

    // Assert
    expect(asked.map(({ items }) => items.map(({ variantId }) => variantId))).toEqual([['11']]);
  });
});
