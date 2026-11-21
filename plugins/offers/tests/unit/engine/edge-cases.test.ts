import { MAX_LINE_QUANTITY } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { aLine, at } from '../../support/builders';
import { aFreeDelivery, aProductDiscount, anOrderDiscount, quoteOf } from '../../support/pipeline';
import { RESEARCH_HOME, researchQuantityOffer, researchQuote } from '../../support/research-fixture';

describe('engine edge cases', () => {
  it('prices at the original price when no offer is eligible', () => {
    // Act
    const quote = researchQuote(2, 'home', []);

    // Assert
    expect(quote).toMatchObject({ subtotal: 9_800, discountTotal: 0, total: 10_600, savings: 0, nudge: null });
    expect(quote.applied).toEqual([]);
    expect(quote.skipped).toEqual([]);
    expect(quote.suggestions).toEqual([]);
    expect(quote.lines[0]?.discounts).toEqual([]);
  });

  it('reports every offer skipped and leaves the price untouched', () => {
    // Arrange
    const offers = [
      researchQuantityOffer({ startsAt: at(60) }),
      aProductDiscount({ endsAt: at(-1) }),
      anOrderDiscount({ config: { valueType: 'percent', value: 10, minimum: { type: 'amount', min: 50_000 } } }),
      aFreeDelivery({ eligibility: { audience: 'everyone', channels: [], wilayas: ['31'], deliveryMethods: [] } }),
    ];

    // Act
    const quote = quoteOf({ offers, shipping: RESEARCH_HOME }, { lines: [aLine()] });

    // Assert
    expect(quote.applied).toEqual([]);
    expect(quote.skipped).toEqual(
      expect.arrayContaining([
        { offerId: '7101', reason: 'not_started' },
        { offerId: '7002', reason: 'ended' },
        { offerId: '7003', reason: 'min_not_met' },
        { offerId: '7004', reason: 'wilaya' },
      ]),
    );
    expect(quote).toMatchObject({ subtotal: 4_900, discountTotal: 0, total: 5_700, savings: 0 });
  });

  it('prices a zero-price variant at 0 without a negative amount', () => {
    // Arrange
    const lines = [aLine({ originalPrice: 0, quantity: 3 })];
    const offers = [
      researchQuantityOffer(),
      aProductDiscount({ config: { valueType: 'fixed', value: 500, appliesTo: 'targets' } }),
    ];

    // Act
    const quote = quoteOf({ offers, shipping: RESEARCH_HOME }, { lines });

    // Assert
    expect(quote.lines[0]).toMatchObject({ unitPrice: 0, totalPrice: 0 });
    expect(quote.subtotal).toBe(0);
    expect(quote.total).toBe(0);
    expect(quote.lines[0]?.discounts.every((discount) => discount.amount >= 0)).toBe(true);
  });

  it('prices the largest quantity 999 at the top tier', () => {
    // Act
    const quote = researchQuote(MAX_LINE_QUANTITY);

    // Assert
    expect(quote.lines[0]).toMatchObject({ quantity: 999, unitPrice: 4_165, totalPrice: 999 * 4_165 });
    expect(quote.delivery).toMatchObject({ waived: true, price: 0 });
    expect(quote.total).toBe(4_160_835);
    expect(quote.nudge).toBeNull();
  });
});
