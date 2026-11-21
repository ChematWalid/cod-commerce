import { describe, expect, it } from 'vitest';
import {
  freeDeliveryConfigSchema,
  MAX_TIERS,
  MONEY_MAX_DZD,
  offerInputSchema,
  orderDiscountConfigSchema,
  PRICING_ERROR_CODES,
  productDiscountConfigSchema,
  quantityConfigSchema,
} from '../../src/index';

const tier = (quantity: number, price: number, preselected = false) => ({
  quantity,
  price,
  preselected,
  freeDelivery: false,
});

describe('quantityConfigSchema', () => {
  it('accepts the research tiers 2 pieces -10 % and 3 pieces with free delivery', () => {
    const config = {
      priceMode: 'percent',
      tiers: [tier(2, 10, true), { ...tier(3, 15), freeDelivery: true, label: { ar: 'الأكثر طلبا' } }],
    };

    expect(quantityConfigSchema.safeParse(config).success).toBe(true);
  });

  it('refuses quantity tiers out of order', () => {
    const config = { priceMode: 'percent', tiers: [tier(3, 15), tier(2, 10)] };

    expect(quantityConfigSchema.safeParse(config).success).toBe(false);
  });

  it('refuses two tiers of one quantity', () => {
    expect(quantityConfigSchema.safeParse({ priceMode: 'percent', tiers: [tier(2, 10), tier(2, 15)] }).success).toBe(
      false,
    );
  });

  it('refuses two preselected tiers', () => {
    const config = { priceMode: 'percent', tiers: [tier(2, 10, true), tier(3, 15, true)] };

    expect(quantityConfigSchema.safeParse(config).success).toBe(false);
  });

  it('reports a tier price above the money range with the invalid-config code', () => {
    const config = { priceMode: 'total', tiers: [tier(2, MONEY_MAX_DZD + 1)] };

    const result = quantityConfigSchema.safeParse(config);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([PRICING_ERROR_CODES.INVALID_CONFIG]);
  });

  it('refuses a percent above 100', () => {
    expect(quantityConfigSchema.safeParse({ priceMode: 'percent', tiers: [tier(2, 101)] }).success).toBe(false);
    expect(productDiscountConfigSchema.safeParse({ valueType: 'percent', value: 101, appliesTo: 'all' }).success).toBe(
      false,
    );
    expect(orderDiscountConfigSchema.safeParse({ valueType: 'percent', value: 101 }).success).toBe(false);
  });

  it('accepts a tier total above 100 in total price mode', () => {
    expect(quantityConfigSchema.safeParse({ priceMode: 'total', tiers: [tier(2, 8820)] }).success).toBe(true);
  });

  it('refuses no tiers and more than the tier limit', () => {
    const tooMany = Array.from({ length: MAX_TIERS + 1 }, (_unused, index) => tier(index + 1, 5));

    expect(quantityConfigSchema.safeParse({ priceMode: 'percent', tiers: [] }).success).toBe(false);
    expect(quantityConfigSchema.safeParse({ priceMode: 'percent', tiers: tooMany }).success).toBe(false);
  });
});

describe('freeDeliveryConfigSchema', () => {
  it('accepts every free-delivery threshold form', () => {
    const thresholds = [{ type: 'none' }, { type: 'pieces', min: 3 }, { type: 'amount', min: 10000 }];

    for (const threshold of thresholds) {
      expect(freeDeliveryConfigSchema.safeParse({ threshold }).success).toBe(true);
    }
  });

  it('refuses a pieces threshold of 0 and an unknown form', () => {
    expect(freeDeliveryConfigSchema.safeParse({ threshold: { type: 'pieces', min: 0 } }).success).toBe(false);
    expect(freeDeliveryConfigSchema.safeParse({ threshold: { type: 'weight', min: 1 } }).success).toBe(false);
  });
});

describe('discount configs', () => {
  it('fills defaults of a product discount', () => {
    expect(productDiscountConfigSchema.parse({ valueType: 'fixed', value: 500, appliesTo: 'targets' })).toEqual({
      valueType: 'fixed',
      value: 500,
      cap: null,
      appliesTo: 'targets',
      showCountdown: false,
    });
  });

  it('refuses a zero discount value', () => {
    expect(productDiscountConfigSchema.safeParse({ valueType: 'fixed', value: 0, appliesTo: 'all' }).success).toBe(
      false,
    );
  });

  it('accepts an order discount with each minimum form', () => {
    const minimums = [{ type: 'none' }, { type: 'amount', min: 5000 }, { type: 'pieces', min: 2 }];

    for (const minimum of minimums) {
      expect(orderDiscountConfigSchema.safeParse({ valueType: 'percent', value: 10, cap: 1000, minimum }).success).toBe(
        true,
      );
    }
  });
});

describe('offerInputSchema', () => {
  it('accepts a quantity offer draft and fills the shared defaults', () => {
    const offer = offerInputSchema.parse({
      kind: 'quantity',
      title: '2 pieces -10 %',
      config: { priceMode: 'percent', tiers: [tier(2, 10)] },
      targets: [{ refType: 'product', refId: '42' }],
    });

    expect(offer.method).toBe('automatic');
    expect(offer.combinesWith).toEqual({ order: false, product: false, delivery: false });
    expect(offer.eligibility).toEqual({ audience: 'everyone', channels: [], wilayas: [], deliveryMethods: [] });
    expect(offer.targets).toEqual([{ role: 'buy', refType: 'product', refId: '42' }]);
  });

  it('accepts an offer target with the get and addon roles', () => {
    const offer = offerInputSchema.parse({
      kind: 'bxgy',
      title: 'Buy 2 get 1',
      config: {},
      targets: [
        { role: 'get', refType: 'product', refId: '43' },
        { role: 'addon', refType: 'variant', refId: '44' },
      ],
    });

    expect(offer.targets.map((target) => target.role)).toEqual(['get', 'addon']);
  });

  it('still defaults a target role to buy', () => {
    const offer = offerInputSchema.parse({
      kind: 'bxgy',
      title: 'Buy 2 get 1',
      config: {},
      targets: [{ refType: 'collection', refId: '7' }],
    });

    expect(offer.targets).toEqual([{ role: 'buy', refType: 'collection', refId: '7' }]);
    expect(offerInputSchema.safeParse({ ...offer, targets: [{ ...offer.targets[0], role: 'gift' }] }).success).toBe(
      false,
    );
  });

  it.each(['2147483648', '99999999999999999999'])('refuses a target refId above the int range: %s', (refId) => {
    const result = offerInputSchema.safeParse({
      kind: 'quantity',
      title: '2 pieces -10 %',
      config: {},
      targets: [{ refType: 'variant', refId }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PRICING_ERROR_CODES.INVALID_CONFIG);
  });

  it('refuses an end before the start and an unknown wilaya', () => {
    const base = { kind: 'order_discount', title: 'Spring', config: {} };

    expect(
      offerInputSchema.safeParse({
        ...base,
        startsAt: '2026-12-01T00:00:00.000Z',
        endsAt: '2026-11-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
    expect(offerInputSchema.safeParse({ ...base, eligibility: { wilayas: ['59'] } }).success).toBe(false);
  });
});
