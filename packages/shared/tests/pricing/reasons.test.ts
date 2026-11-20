import { describe, expect, it } from 'vitest';
import {
  AUDIENCES,
  CODE_REJECT_REASONS,
  COMBINATION_CLASSES,
  DELIVERY_METHODS,
  OFFER_METHODS,
  OFFER_STATUSES,
  ORDER_PRICING_MODES,
  PRICING_CHANNELS,
  PRICING_ERROR_CODES,
  QUOTE_VERIFY_FAILURES,
  SKIP_REASONS,
} from '../../src/index';

const LISTS = {
  SKIP_REASONS,
  CODE_REJECT_REASONS,
  QUOTE_VERIFY_FAILURES,
  PRICING_CHANNELS,
  DELIVERY_METHODS,
  AUDIENCES,
  OFFER_METHODS,
  OFFER_STATUSES,
  COMBINATION_CLASSES,
  ORDER_PRICING_MODES,
};

describe('pricing reason lists', () => {
  it.each(Object.entries(LISTS))('keeps reason lists free of duplicates: %s', (_name, values) => {
    expect(new Set(values).size).toBe(values.length);
  });

  it('lists every skip reason of the brief', () => {
    expect(SKIP_REASONS).toEqual(
      expect.arrayContaining(['no_tier_reached', 'not_started', 'ended', 'audience', 'channel', 'wilaya']),
    );
    expect(SKIP_REASONS).toEqual(expect.arrayContaining(['usage_limit', 'not_combinable']));
  });

  it('treats an unknown key id as a bad signature, not its own failure', () => {
    expect(QUOTE_VERIFY_FAILURES).toEqual([
      'malformed',
      'bad_signature',
      'expired',
      'business_mismatch',
      'store_mismatch',
      'cart_mismatch',
    ]);
  });

  it('gives every pricing error a distinct code', () => {
    const codes = Object.values(PRICING_ERROR_CODES);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('pricing.invalid-request');
  });
});
