import { describe, expect, it } from 'vitest';
import { mergeLines } from '../../../domain/engine/merge-lines';
import { A_BUYER, aLine, at } from '../../support/builders';
import { aFreeDelivery, anOrderDiscount, aQuantityOffer, HOME_800, quoteOf } from '../../support/pipeline';

describe('priceCart', () => {
  it('merges two lines of one variant before tier counting', () => {
    // Arrange
    const lines = [aLine({ variantId: '11' }), aLine({ variantId: '11' })];

    // Act
    const quote = quoteOf({ offers: [aQuantityOffer()] }, { lines });

    // Assert
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]).toMatchObject({ key: '11', quantity: 2, unitPrice: 4_410, totalPrice: 8_820 });
    expect(quote.tokenLines).toEqual([
      { variantId: '11', qty: 2, unitPrice: 4_410, originalPrice: 4_900, offerIds: ['7001'] },
    ]);
  });

  it('prices two pieces at home with the 2-piece tier and the 800 fee', () => {
    // Arrange
    const lines = [aLine({ quantity: 2 })];

    // Act
    const quote = quoteOf({ offers: [aQuantityOffer()], shipping: HOME_800 }, { lines });

    // Assert
    expect(quote).toMatchObject({ subtotal: 8_820, discountTotal: 0, total: 9_620, savings: 980 });
    expect(quote.lines[0]?.discounts).toEqual([{ offerId: '7001', kind: 'quantity', amount: 980 }]);
    expect(quote.applied).toEqual([{ offerId: '7001', kind: 'quantity', amount: 980 }]);
  });

  it('waives delivery at the 3-piece tier with price 0', () => {
    // Arrange
    const lines = [aLine({ quantity: 3 })];

    // Act
    const quote = quoteOf({ offers: [aQuantityOffer()], shipping: HOME_800 }, { lines });

    // Assert
    expect(quote.delivery).toMatchObject({ waived: true, price: 0, freeShipping: true, fee: 800 });
    expect(quote.total).toBe(12_495);
    expect(quote.savings).toBe(3 * 735 + 800);
  });

  it('nudges one piece toward the 2-piece tier', () => {
    // Act
    const quote = quoteOf({ offers: [aQuantityOffer()] });

    // Assert
    expect(quote.nudge).toEqual({ type: 'next_tier', offerId: '7001', units: 1, tierQuantity: 2, saving: 980 });
    expect(quote.skipped).toEqual([{ offerId: '7001', reason: 'no_tier_reached' }]);
  });

  it('suggests the pieces missing for free delivery', () => {
    // Arrange
    const offer = aFreeDelivery({ config: { threshold: { type: 'pieces', min: 3 } } });

    // Act
    const quote = quoteOf({ offers: [offer], shipping: HOME_800 });

    // Assert
    expect(quote.suggestions).toEqual([{ type: 'free_delivery', offerId: '7004', missing: { pieces: 2 } }]);
    expect(quote.skipped).toEqual([{ offerId: '7004', reason: 'min_not_met' }]);
  });

  it('lists skipped offers with reasons and leaves silent offers out', () => {
    // Arrange
    const notStarted = aQuantityOffer({
      startsAt: at(60),
      config: { priceMode: 'percent', tiers: [{ quantity: 1, price: 5 }] },
    });
    const otherProduct = aQuantityOffer({ id: '7005', targets: [{ role: 'buy', refType: 'product', refId: '2' }] });
    const unresolvedDelivery = aFreeDelivery();

    // Act
    const quote = quoteOf({ offers: [notStarted, otherProduct, unresolvedDelivery] });

    // Assert
    expect(quote.skipped).toEqual([{ offerId: '7001', reason: 'not_started' }]);
    expect(quote.applied).toEqual([]);
  });

  it('emits orderPricingMode quote', () => {
    // Act
    const quote = quoteOf({});

    // Assert
    expect(quote).toMatchObject({
      currency: 'DZD',
      orderPricingMode: 'quote',
      available: true,
      unavailableVariantIds: [],
      subtotal: 4_900,
      total: 4_900,
      phoneUsed: false,
    });
  });

  it('marks the phone used when an applied offer reads the buyer', () => {
    // Arrange
    const firstOrder = anOrderDiscount({
      eligibility: { audience: 'first', channels: [], wilayas: [], deliveryMethods: [] },
    });

    // Act
    const quote = quoteOf({ offers: [firstOrder], buyerOrderCount: 0 }, { buyer: A_BUYER });

    // Assert
    expect(quote.phoneUsed).toBe(true);
    expect(quote.tokenDiscounts).toEqual([{ amount: 490, offerId: '7003' }]);
  });

  it('leaves the phone unused when the reading offer is skipped', () => {
    // Arrange
    const limited = anOrderDiscount({ perBuyerLimit: 1 });

    // Act
    const quote = quoteOf({ offers: [limited], perBuyerUsage: new Map([['7003', 1]]) }, { buyer: A_BUYER });

    // Assert
    expect(quote.phoneUsed).toBe(false);
    expect(quote.skipped).toEqual([{ offerId: '7003', reason: 'per_buyer_limit' }]);
  });
});

describe('mergeLines', () => {
  it('sums the quantities of one variant in first-seen order', () => {
    // Act
    const merged = mergeLines([
      { variantId: '12', quantity: 1 },
      { variantId: '11', quantity: 2 },
      { variantId: '12', quantity: 3 },
    ]);

    // Assert
    expect(merged).toEqual([
      { variantId: '12', quantity: 4 },
      { variantId: '11', quantity: 2 },
    ]);
  });
});
