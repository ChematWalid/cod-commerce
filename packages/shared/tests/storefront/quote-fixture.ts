import type { Quote } from '../../src/pricing/quote';

/** A full engine quote with one discounted line, home delivery and only public reasons. */
export function quoteFixture(): Quote {
  return {
    currency: 'DZD',
    lines: [
      {
        key: '12',
        productId: '5',
        variantId: '12',
        quantity: 2,
        originalPrice: 2500,
        unitPrice: 2250,
        totalPrice: 4500,
        discounts: [{ offerId: '7300000000000000001', kind: 'quantity', amount: 500 }],
      },
    ],
    discounts: [],
    subtotal: 4500,
    discountTotal: 0,
    delivery: {
      resolved: true,
      fee: 600,
      overweightFee: 0,
      waived: false,
      price: 600,
      freeShipping: false,
      speed: null,
    },
    total: 5100,
    savings: 500,
    nudge: { type: 'next_tier', offerId: '7300000000000000001', units: 1, tierQuantity: 3, saving: 300 },
    applied: [{ offerId: '7300000000000000001', kind: 'quantity', amount: 500 }],
    skipped: [{ offerId: '7300000000000000002', reason: 'min_not_met' }],
    rejectedCodes: [{ code: 'OLD', reason: 'ended' }],
    rejectedAddons: [],
    suggestions: [{ type: 'free_delivery', offerId: '7300000000000000003', missing: { amount: 900 } }],
    quoteToken: 'qt1.payload.signature',
    expiresAt: '2026-11-27T10:15:00.000Z',
    available: true,
    orderPricingMode: 'quote',
    unavailableVariantIds: [],
  };
}
