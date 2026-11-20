import { describe, expect, it } from 'vitest';
import { addonConfigSchema, MAX_ADDON_PIECES, MONEY_MAX_DZD, PRICING_ERROR_CODES } from '../../src/index';

const thankYouAddon = {
  condition: 'any_order',
  price: { mode: 'fixed', value: 1500 },
  maxPiecesPerOrder: 2,
  placement: 'thank_you',
};

describe('addonConfigSchema', () => {
  it('accepts an add-on at a fixed price shown on the thank-you page', () => {
    expect(addonConfigSchema.parse(thankYouAddon)).toEqual(thankYouAddon);
  });

  it('accepts a free add-on and a percent or amount off on the order form', () => {
    const base = { ...thankYouAddon, condition: 'targets', placement: 'order_form' };

    expect(addonConfigSchema.safeParse({ ...base, price: { mode: 'fixed', value: 0 } }).success).toBe(true);
    expect(addonConfigSchema.safeParse({ ...base, price: { mode: 'percent', value: 30 } }).success).toBe(true);
    expect(addonConfigSchema.safeParse({ ...base, price: { mode: 'amount_off', value: 200 } }).success).toBe(true);
  });

  it('refuses an add-on percent of 0', () => {
    const result = addonConfigSchema.safeParse({ ...thankYouAddon, price: { mode: 'percent', value: 0 } });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PRICING_ERROR_CODES.INVALID_CONFIG);
  });

  it('refuses an amount off of 0 and a fixed price above the money range', () => {
    expect(addonConfigSchema.safeParse({ ...thankYouAddon, price: { mode: 'amount_off', value: 0 } }).success).toBe(
      false,
    );
    expect(
      addonConfigSchema.safeParse({ ...thankYouAddon, price: { mode: 'fixed', value: MONEY_MAX_DZD + 1 } }).success,
    ).toBe(false);
  });

  it('refuses a per-order piece cap outside 1 to the cap and an unknown placement', () => {
    expect(addonConfigSchema.safeParse({ ...thankYouAddon, maxPiecesPerOrder: 0 }).success).toBe(false);
    expect(addonConfigSchema.safeParse({ ...thankYouAddon, maxPiecesPerOrder: MAX_ADDON_PIECES + 1 }).success).toBe(
      false,
    );
    expect(addonConfigSchema.safeParse({ ...thankYouAddon, placement: 'cart' }).success).toBe(false);
  });
});
