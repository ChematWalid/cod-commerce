import { describe, expect, it } from 'vitest';
import { bxgyConfigSchema, MAX_BXGY_QUANTITY, MAX_BXGY_TIMES, PRICING_ERROR_CODES } from '../../src/index';

const buyTwoGetOneFree = {
  appliesTo: 'targets',
  buyQuantity: 2,
  getQuantity: 1,
  getFrom: 'same',
  gift: { mode: 'free' },
};

describe('bxgyConfigSchema', () => {
  it('accepts buy 2 get 1 free from the same product', () => {
    const result = bxgyConfigSchema.safeParse(buyTwoGetOneFree);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ...buyTwoGetOneFree, maxTimesPerOrder: null });
  });

  it('accepts a gift at a percent or a fixed amount off from the targets', () => {
    const percentGift = { ...buyTwoGetOneFree, getFrom: 'targets', gift: { mode: 'percent', value: 50 } };
    const fixedGift = { ...buyTwoGetOneFree, gift: { mode: 'fixed', value: 500 }, maxTimesPerOrder: 1 };

    expect(bxgyConfigSchema.safeParse(percentGift).success).toBe(true);
    expect(bxgyConfigSchema.safeParse(fixedGift).success).toBe(true);
  });

  it('refuses a percent gift above 100', () => {
    const result = bxgyConfigSchema.safeParse({ ...buyTwoGetOneFree, gift: { mode: 'percent', value: 101 } });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PRICING_ERROR_CODES.INVALID_CONFIG);
  });

  it('refuses a fixed gift of 0 and an unknown gift mode', () => {
    expect(bxgyConfigSchema.safeParse({ ...buyTwoGetOneFree, gift: { mode: 'fixed', value: 0 } }).success).toBe(false);
    expect(bxgyConfigSchema.safeParse({ ...buyTwoGetOneFree, gift: { mode: 'price', value: 1 } }).success).toBe(false);
  });

  it('refuses max times 0', () => {
    expect(bxgyConfigSchema.safeParse({ ...buyTwoGetOneFree, maxTimesPerOrder: 0 }).success).toBe(false);
    expect(bxgyConfigSchema.safeParse({ ...buyTwoGetOneFree, maxTimesPerOrder: MAX_BXGY_TIMES + 1 }).success).toBe(
      false,
    );
  });

  it('refuses buy or get quantities outside 1 to the cap', () => {
    expect(bxgyConfigSchema.safeParse({ ...buyTwoGetOneFree, buyQuantity: 0 }).success).toBe(false);
    expect(bxgyConfigSchema.safeParse({ ...buyTwoGetOneFree, getQuantity: MAX_BXGY_QUANTITY + 1 }).success).toBe(false);
  });
});
