import { describe, expect, it } from 'vitest';
import { aCode, anActiveOffer, scopeA } from '../support/offer-records';
import { aRequest, PRODUCT_1_TARGET, setUpPricing } from '../support/pricing-service';
import { payloadOf } from '../support/quote-token';

const TWO_PIECES_10_PERCENT = { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] };

/** The quantity offer of the worked examples: 10 % off from two pieces of product 1. */
const aTwoPieceOffer = () => anActiveOffer({ config: TWO_PIECES_10_PERCENT, targets: PRODUCT_1_TARGET });

/** An order placed without any offer or code. */
const NOTHING_HELD = { offerIds: [], codes: [] };

/** Variant 11 (sold at 4,900) with variant 99, which the store's gate refuses. */
const withUnavailableLine = (quantity: number) =>
  aRequest(1, {
    lines: [
      { variantId: '11', quantity: 1 },
      { variantId: '99', quantity },
    ],
  });

describe('PricingService.repriceOrder', () => {
  it('reprices 1 to 2 pieces with delta 3920', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    seed(scopeA, aTwoPieceOffer());

    // Act
    const result = await service.repriceOrder(stores.contextOf(scopeA), {
      current: aRequest(1),
      next: aRequest(2),
      orderUsage: NOTHING_HELD,
    });

    // Assert
    expect(result.available).toBe(true);
    expect(result.before.total).toBe(4_900);
    expect(result.after.total).toBe(8_820);
    expect(result.available && result.delta).toBe(3_920);
  });

  it('returns order fields whose discounts JSON matches the d entries of a quote of the changed cart', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const orderDiscount = anActiveOffer({
      kind: 'order_discount',
      config: { valueType: 'percent', value: 10 },
      combinesWith: { order: false, product: true, delivery: false },
    });
    const quantity = anActiveOffer({
      config: TWO_PIECES_10_PERCENT,
      targets: PRODUCT_1_TARGET,
      combinesWith: { order: true, product: false, delivery: false },
    });
    seed(scopeA, orderDiscount, quantity);

    const ctx = stores.contextOf(scopeA);

    // Act
    const result = await service.repriceOrder(ctx, {
      current: aRequest(1),
      next: aRequest(2),
      orderUsage: NOTHING_HELD,
    });

    // Assert
    if (!result.available) throw new Error('expected a priced order change');
    const payload = payloadOf((await service.quote(ctx, aRequest(2))).quoteToken ?? '');
    expect(payload.d).toHaveLength(1);
    expect(JSON.parse(result.orderFields.quoteDiscounts)).toEqual(payload.d);
    expect(result.orderFields.lines).toEqual([
      { variantId: '11', quotedUnitPrice: 4_410, originalPrice: 4_900, offerIds: [quantity.id] },
    ]);
    expect(result.orderFields.quotedShipping).toBe(result.after.delivery.price);
  });

  it('refuses to reprice an order whose current cart has an unavailable variant', async () => {
    // Arrange
    const { service, stores } = setUpPricing();

    // Act
    const result = await service.repriceOrder(stores.contextOf(scopeA), {
      current: withUnavailableLine(1),
      next: aRequest(1),
      orderUsage: NOTHING_HELD,
    });

    // Assert
    expect(result).toMatchObject({ available: false, unavailableVariantIds: ['99'] });
    expect(result).not.toHaveProperty('delta');
    expect(result).not.toHaveProperty('orderFields');
  });

  it('returns no order fields when the changed cart has an unavailable variant', async () => {
    // Arrange
    const { service, stores } = setUpPricing();

    // Act
    const result = await service.repriceOrder(stores.contextOf(scopeA), {
      current: aRequest(1),
      next: withUnavailableLine(3),
      orderUsage: NOTHING_HELD,
    });

    // Assert
    expect(result).toMatchObject({ available: false, unavailableVariantIds: ['99'] });
    expect(result).not.toHaveProperty('delta');
    expect(result).not.toHaveProperty('orderFields');
  });

  describe('of an order that holds the last allowed use', () => {
    it('keeps an offer at its total limit that the order itself used', async () => {
      // Arrange
      const { service, stores, seed } = setUpPricing();
      const offer = anActiveOffer({
        config: TWO_PIECES_10_PERCENT,
        targets: PRODUCT_1_TARGET,
        totalUsageLimit: 1,
        usageCount: 1,
      });
      seed(scopeA, offer);

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2),
        next: aRequest(3),
        orderUsage: { offerIds: [offer.id], codes: [] },
      });

      // Assert
      expect(result.before.total).toBe(8_820);
      expect(result.after.total).toBe(13_230);
      expect(result.available && result.delta).toBe(4_410);
      expect(result.available && result.orderFields.lines[0]?.offerIds).toEqual([offer.id]);
    });

    it('keeps a code at its own limit that the order itself used', async () => {
      // Arrange
      const { service, stores, seed, tables } = setUpPricing();
      const offer = anActiveOffer({ config: TWO_PIECES_10_PERCENT, targets: PRODUCT_1_TARGET, method: 'codes' });
      seed(scopeA, offer);
      tables.codeRows.push({ ...scopeA, value: aCode(offer.id, 'INFLU10', { usageLimit: 1, usageCount: 1 }) });
      const codes = ['INFLU10'];

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { codes }),
        next: aRequest(3, { codes }),
        orderUsage: { offerIds: [offer.id], codes },
      });

      // Assert
      expect(result.before.rejectedCodes).toEqual([]);
      expect(result.available && result.delta).toBe(4_410);
    });

    it("keeps a per-buyer limited offer the buyer's use of which is this order", async () => {
      // Arrange
      const { service, stores, seed, usage } = setUpPricing();
      const offer = anActiveOffer({ config: TWO_PIECES_10_PERCENT, targets: PRODUCT_1_TARGET, perBuyerLimit: 1 });
      seed(scopeA, offer);
      usage.register({ perBuyer: () => Promise.resolve(new Map([[offer.id, 1]])) });
      const phone = '0555123456';

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { phone }),
        next: aRequest(3, { phone }),
        orderUsage: { offerIds: [offer.id], codes: [] },
      });

      // Assert
      expect(result.before.total).toBe(8_820);
      expect(result.available && result.delta).toBe(4_410);
    });

    it('still skips an offer at its limit that the order does not hold', async () => {
      // Arrange
      const { service, stores, seed } = setUpPricing();
      seed(
        scopeA,
        anActiveOffer({ config: TWO_PIECES_10_PERCENT, targets: PRODUCT_1_TARGET, totalUsageLimit: 1, usageCount: 1 }),
      );

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2),
        next: aRequest(3),
        orderUsage: { offerIds: [], codes: [] },
      });

      // Assert
      expect(result.before.skipped).toEqual([expect.objectContaining({ reason: 'usage_limit' })]);
      expect(result.available && result.delta).toBe(4_900);
    });
  });
});
