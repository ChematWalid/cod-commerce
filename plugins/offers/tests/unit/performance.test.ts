import { INT_COLUMN_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { aggregatePerformance, type OfferOrderFact } from '../../domain/performance';

const OFFER = '7001';
const OTHER = '7002';

/** Three orders holding offer 7001: one open, one voided, one delivered at 9,620 with 980 off. */
const FACTS: readonly OfferOrderFact[] = [
  { orderId: '9001', state: 'open', total: 5_700, offers: [{ offerId: OFFER, amount: 0 }] },
  { orderId: '9002', state: 'void', total: 9_620, offers: [{ offerId: OFFER, amount: 980 }] },
  {
    orderId: '9003',
    state: 'delivered',
    total: 9_620,
    offers: [
      { offerId: OFFER, amount: 980 },
      { offerId: OTHER, amount: 800 },
    ],
  },
];

describe('aggregatePerformance (D2514)', () => {
  it('returns zeros before any order', () => {
    // Arrange
    const facts: readonly OfferOrderFact[] = [];

    // Act
    const performance = aggregatePerformance(facts, [OFFER, OTHER]);

    // Assert
    expect(performance.get(OFFER)).toEqual({ orders: 0, deliveredRevenue: 0, discountGiven: 0 });
    expect(performance.get(OTHER)).toEqual({ orders: 0, deliveredRevenue: 0, discountGiven: 0 });
  });

  it('counts open and delivered orders but not void ones', () => {
    // Arrange
    const facts = FACTS;

    // Act
    const performance = aggregatePerformance(facts, [OFFER, OTHER]);

    // Assert
    expect(performance.get(OFFER)?.orders).toBe(2);
    expect(performance.get(OTHER)?.orders).toBe(1);
  });

  it('sums delivered revenue only for delivered orders', () => {
    // Arrange
    const facts = FACTS;

    // Act
    const performance = aggregatePerformance(facts, [OFFER]);

    // Assert
    expect(performance.get(OFFER)?.deliveredRevenue).toBe(9_620);
  });

  it('sums the discount given per offer', () => {
    // Arrange
    const facts = FACTS;

    // Act
    const performance = aggregatePerformance(facts, [OFFER, OTHER]);

    // Assert
    expect(performance.get(OFFER)?.discountGiven).toBe(980);
    expect(performance.get(OTHER)?.discountGiven).toBe(800);
  });

  it('counts an order once when it holds the offer twice, and answers only the offers asked for', () => {
    // Arrange
    const twice: OfferOrderFact = {
      orderId: '9004',
      state: 'delivered',
      total: 10_000,
      offers: [
        { offerId: OFFER, amount: 100 },
        { offerId: OFFER, amount: 200 },
      ],
    };

    // Act
    const performance = aggregatePerformance([twice], [OFFER]);

    // Assert
    expect(performance.get(OFFER)).toEqual({ orders: 1, deliveredRevenue: 10_000, discountGiven: 300 });
    expect(performance.has(OTHER)).toBe(false);
  });

  it('sums two orders each at the largest stored total exactly, past the 32-bit range', () => {
    // Arrange
    const big = (orderId: string): OfferOrderFact => ({
      orderId,
      state: 'delivered',
      total: INT_COLUMN_MAX,
      offers: [{ offerId: OFFER, amount: INT_COLUMN_MAX }],
    });

    // Act
    const performance = aggregatePerformance([big('9005'), big('9006')], [OFFER]);

    // Assert
    expect(performance.get(OFFER)).toEqual({
      orders: 2,
      deliveredRevenue: 2 * INT_COLUMN_MAX,
      discountGiven: 2 * INT_COLUMN_MAX,
    });
  });
});
