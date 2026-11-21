import { describe, expect, it } from 'vitest';
import {
  ADDON_PLACEMENTS,
  ADDON_REJECT_REASONS,
  AUDIENCES,
  CODE_REJECT_REASONS,
  COMBINATION_CLASSES,
  DELIVERY_METHODS,
  OFFER_METHODS,
  OFFER_APP_GOALS,
  OFFER_STATUSES,
  OFFER_TARGET_ROLES,
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
  OFFER_TARGET_ROLES,
  ADDON_PLACEMENTS,
  OFFER_APP_GOALS,
};

describe('pricing reason lists', () => {
  it.each(Object.entries(LISTS))('keeps reason lists free of duplicates: %s', (_name, values) => {
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps add-on reject reasons free of duplicates', () => {
    expect(ADDON_REJECT_REASONS).toEqual(['not_offered', 'not_eligible', 'unavailable']);
    expect(new Set(ADDON_REJECT_REASONS).size).toBe(ADDON_REJECT_REASONS.length);
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

  it('gives the offers admin and post-order add-on refusals their own codes', () => {
    expect(Object.values(PRICING_ERROR_CODES)).toEqual(
      expect.arrayContaining([
        'offers.invalid-targets',
        'offers.publish-invalid',
        'offers.offer-not-deletable',
        'offers.order-addon-unavailable',
        'offers.order-not-editable',
        'offers.order-not-found',
        'offers.addon-not-offered',
      ]),
    );
  });
});
