import type { QuoteRequestInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidQuoteRequestError } from '../../domain/errors';
import type { OrderUsage } from '../../domain/engine/order-usage';
import { anActiveOffer, scopeA } from '../support/offer-records';
import { aRequest, PRODUCT_1_TARGET, setUpPricing } from '../support/pricing-service';

const TWO_PIECES_10_PERCENT = { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] };
const BUYER_PHONE = '0555123456';
const OTHER_PHONE = '0555999888';

/** The two-piece offer for buyers of the given audience only. */
const anAudienceOffer = (audience: 'first' | 'returning') =>
  anActiveOffer({
    config: TWO_PIECES_10_PERCENT,
    targets: PRODUCT_1_TARGET,
    eligibility: { audience, channels: [], wilayas: [], deliveryMethods: [] },
  });

/** A buyer history whose count already includes the order being repriced, as P3.S4's source will. */
const ORDER_COUNT_WITH_THIS_ORDER = 1;

/** The same buyer history once the buyer has placed a second order after the one being repriced. */
const ORDER_COUNT_WITH_A_LATER_ORDER = 2;

describe('PricingService.repriceOrder guards', () => {
  describe("of a buyer's first order", () => {
    it("keeps a first-order offer on an order that was the buyer's first", async () => {
      // Arrange
      const { service, stores, seed, buyers } = setUpPricing();
      const offer = anAudienceOffer('first');
      seed(scopeA, offer);
      buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_THIS_ORDER) });

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { phone: BUYER_PHONE }),
        next: aRequest(3, { phone: BUYER_PHONE }),
        orderUsage: { offerIds: [offer.id], codes: [] },
      });

      // Assert
      expect(result.before.total).toBe(8_820);
      expect(result.after.total).toBe(13_230);
      expect(result.available && result.delta).toBe(4_410);
      expect(result.available && result.orderFields.lines[0]?.offerIds).toEqual([offer.id]);
    });

    it('never gives a returning-buyer offer to an order that was the buyer first', async () => {
      // Arrange
      const { service, stores, seed, buyers } = setUpPricing();
      seed(scopeA, anAudienceOffer('returning'));
      buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_THIS_ORDER) });

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { phone: BUYER_PHONE }),
        next: aRequest(3, { phone: BUYER_PHONE }),
        orderUsage: { offerIds: [], codes: [] },
      });

      // Assert
      expect(result.before.total).toBe(9_800);
      expect(result.available && result.delta).toBe(4_900);
      expect(result.available && result.orderFields.lines[0]?.offerIds).toEqual([]);
    });

    it("keeps a first-order offer on the buyer's first order after the buyer has ordered again", async () => {
      // Arrange
      const { service, stores, seed, buyers } = setUpPricing();
      const offer = anAudienceOffer('first');
      seed(scopeA, offer);
      buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_A_LATER_ORDER) });

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { phone: BUYER_PHONE }),
        next: aRequest(3, { phone: BUYER_PHONE }),
        orderUsage: { offerIds: [offer.id], codes: [], buyerOrdersBefore: 0 },
      });

      // Assert
      expect(result.before.total).toBe(8_820);
      expect(result.after.total).toBe(13_230);
      expect(result.available && result.orderFields.lines[0]?.offerIds).toEqual([offer.id]);
    });

    it("never gives a returning-buyer offer to the buyer's first order after the buyer has ordered again", async () => {
      // Arrange
      const { service, stores, seed, buyers } = setUpPricing();
      seed(scopeA, anAudienceOffer('returning'));
      buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_A_LATER_ORDER) });

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { phone: BUYER_PHONE }),
        next: aRequest(3, { phone: BUYER_PHONE }),
        orderUsage: { offerIds: [], codes: [], buyerOrdersBefore: 0 },
      });

      // Assert
      expect(result.before.total).toBe(9_800);
      expect(result.after.total).toBe(14_700);
    });
  });

  it("takes an order with no recorded count as the buyer's latest", async () => {
    // Arrange
    const { service, stores, seed, buyers } = setUpPricing();
    const offer = anAudienceOffer('first');
    seed(scopeA, offer);
    buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_THIS_ORDER) });

    // Act
    const result = await service.repriceOrder(stores.contextOf(scopeA), {
      current: aRequest(2, { phone: BUYER_PHONE }),
      next: aRequest(3, { phone: BUYER_PHONE }),
      orderUsage: { offerIds: [offer.id], codes: [], buyerOrdersBefore: null },
    });

    // Assert
    expect(result.available && result.orderFields.lines[0]?.offerIds).toEqual([offer.id]);
  });

  describe('of an order whose phone an edit changes', () => {
    /** The moved-to phone has 5 orders of its own; the order is still stored under the old phone. */
    const countsByPhone = (_ctx: unknown, _scope: unknown, buyer: { phone: string }) =>
      Promise.resolve(buyer.phone.endsWith('999888') ? 5 : ORDER_COUNT_WITH_THIS_ORDER);

    it("returns the moved-to buyer's orders before this one for the order to store", async () => {
      // Arrange
      const { service, stores, seed, buyers } = setUpPricing();
      seed(scopeA, anAudienceOffer('first'));
      buyers.register({ orderCountOf: countsByPhone });

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { phone: BUYER_PHONE }),
        next: aRequest(3, { phone: OTHER_PHONE }),
        orderUsage: { offerIds: [], codes: [], buyerOrdersBefore: 0 },
      });

      // Assert
      expect(result.after.total).toBe(14_700);
      expect(result.available && result.orderFields.buyerOrdersBefore).toBe(5);
    });

    it('never gives a first-order offer on a later edit once the moved-to count is stored', async () => {
      // Arrange
      const { service, stores, seed, buyers } = setUpPricing();
      seed(scopeA, anAudienceOffer('first'));
      buyers.register({ orderCountOf: () => Promise.resolve(6) });

      // Act
      const result = await service.repriceOrder(stores.contextOf(scopeA), {
        current: aRequest(2, { phone: OTHER_PHONE }),
        next: aRequest(3, { phone: OTHER_PHONE }),
        orderUsage: { offerIds: [], codes: [], buyerOrdersBefore: 5 },
      });

      // Assert
      expect(result.after.total).toBe(14_700);
      expect(result.available && result.orderFields.buyerOrdersBefore).toBe(5);
    });
  });

  it.each<[string, number | null | undefined, string | undefined, number | null]>([
    ['the recorded count while the edit keeps the phone', 0, BUYER_PHONE, 0],
    ['the count minus this order when none was recorded', undefined, BUYER_PHONE, 1],
    ['no count when the changed cart has no phone', 0, undefined, null],
  ])('returns %s for the order to store', async (_, recorded, nextPhone, expected) => {
    // Arrange
    const { service, stores, buyers } = setUpPricing();
    buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_A_LATER_ORDER) });

    // Act
    const result = await service.repriceOrder(stores.contextOf(scopeA), {
      current: aRequest(2, { phone: BUYER_PHONE }),
      next: aRequest(3, nextPhone === undefined ? {} : { phone: nextPhone }),
      orderUsage: { offerIds: [], codes: [], buyerOrdersBefore: recorded },
    });

    // Assert
    expect(result.available && result.orderFields.buyerOrdersBefore).toBe(expected);
  });

  it("gives back a buyer's own use only while the changed cart keeps the order's phone", async () => {
    // Arrange
    const { service, stores, seed, usage } = setUpPricing();
    const offer = anActiveOffer({ config: TWO_PIECES_10_PERCENT, targets: PRODUCT_1_TARGET, perBuyerLimit: 1 });
    seed(scopeA, offer);
    usage.register({ perBuyer: () => Promise.resolve(new Map([[offer.id, 1]])) });

    // Act
    const result = await service.repriceOrder(stores.contextOf(scopeA), {
      current: aRequest(2, { phone: BUYER_PHONE }),
      next: aRequest(2, { phone: OTHER_PHONE }),
      orderUsage: { offerIds: [offer.id], codes: [] },
    });

    // Assert
    expect(result.before.total).toBe(8_820);
    expect(result.after.total).toBe(9_800);
  });

  it('issues no quote token on either quote of a reprice, so a released limit never reaches checkout', async () => {
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
      current: aRequest(1),
      next: aRequest(2),
      orderUsage: { offerIds: [offer.id], codes: [] },
    });

    // Assert
    expect(result.after.total).toBe(8_820);
    expect([result.before.quoteToken, result.after.quoteToken]).toEqual([null, null]);
    expect([result.before.expiresAt, result.after.expiresAt]).toEqual([null, null]);
  });

  it.each<[string, unknown]>([
    ['an offer id that is not a snowflake', { offerIds: ['1 OR 1=1'], codes: [] }],
    ['a code that is not text', { offerIds: [], codes: [42] }],
    ['a code longer than a typed code may be', { offerIds: [], codes: ['C'.repeat(65)] }],
    ['more codes than a quote takes', { offerIds: [], codes: ['A', 'B', 'C', 'D', 'E', 'F'] }],
    [
      'more offers than an order can hold',
      { offerIds: Array.from({ length: 500 }, (_, i) => String(1_300_000_000_000_000_000n + BigInt(i))), codes: [] },
    ],
    ['orders before the order that are not a count', { offerIds: [], codes: [], buyerOrdersBefore: -1 }],
    ['orders before the order that are not whole', { offerIds: [], codes: [], buyerOrdersBefore: 0.5 }],
    ['no usage at all', undefined],
  ])('refuses an order usage with %s as InvalidQuoteRequestError', async (_, orderUsage) => {
    // Arrange
    const { service, stores } = setUpPricing();
    const current: QuoteRequestInput = aRequest(1);

    // Act
    const repricing = service.repriceOrder(stores.contextOf(scopeA), {
      current,
      next: aRequest(2),
      orderUsage: orderUsage as OrderUsage,
    });

    // Assert
    await expect(repricing).rejects.toBeInstanceOf(InvalidQuoteRequestError);
  });
});
