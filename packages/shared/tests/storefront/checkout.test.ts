import { describe, expect, it } from 'vitest';
import { formatDzd, formatMoney, storefrontMessages } from '../../src/storefront/i18n/catalogue';
import { CODE_REJECT_REASONS, SKIP_REASONS } from '../../src/pricing/reasons';
import {
  PRIVATE_CODE_REJECT_REASONS,
  PRIVATE_SKIP_REASONS,
  PUBLIC_CODE_REJECT_REASONS,
  PUBLIC_SKIP_REASONS,
  publicQuoteSchema,
  storefrontCartQuoteBodySchema,
  storefrontShippingQuoteBodySchema,
} from '../../src/storefront/checkout';
import { CHECKOUT_FIELD_ERRORS } from '../../src/storefront/checkout-constants';
import { STOREFRONT_API_ROUTES, STOREFRONT_RELAY_PATHS, storefrontApiPath } from '../../src/storefront/routes';
import { inPageCheckoutSettingsOf } from '../../src/storefront/theme/schema';
import { quoteFixture } from './quote-fixture';

const line = { variantId: '12', quantity: 2 };

describe('storefront cart-quote body (D3303)', () => {
  it('strips channel, addons, storeId and waive from a client body', () => {
    // Arrange
    const body = {
      channel: 'dashboard',
      addons: [{ offerId: '7300000000000000001', variantId: '3', quantity: 1 }],
      storeId: '7300000000000000002',
      waive: true,
      lines: [line],
    };
    // Act
    const parsed = storefrontCartQuoteBodySchema.parse(body);
    // Assert
    expect(parsed).toEqual({ lines: [line] });
  });

  it('reads the phone as the quote request does', () => {
    expect(storefrontCartQuoteBodySchema.parse({ lines: [line], phone: '0551234567' }).phone).toBe('+213551234567');
  });
});

describe('storefront shipping-quote body (D3301)', () => {
  const valid = { provinceCode: '16', townOns: '1601', stopdesk: false, items: [{ productId: '5', quantity: 1 }] };

  it('accepts a destination and items and strips waive and storeId', () => {
    expect(storefrontShippingQuoteBodySchema.parse({ ...valid, waive: true, storeId: '9' })).toEqual(valid);
  });

  it.each(['abc', '0', '01', '99999999999'])('refuses the product id %j, which is no core id', (productId) => {
    const result = storefrontShippingQuoteBodySchema.safeParse({ ...valid, items: [{ productId, quantity: 1 }] });
    expect(result.success).toBe(false);
  });

  it.each(['16a', ' 1601', '1'.repeat(17)])('refuses the commune code %j', (townOns) => {
    expect(storefrontShippingQuoteBodySchema.safeParse({ ...valid, townOns }).success).toBe(false);
  });

  it('refuses an empty item list and a zero quantity', () => {
    expect(storefrontShippingQuoteBodySchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    const zero = { ...valid, items: [{ productId: '5', quantity: 0 }] };
    expect(storefrontShippingQuoteBodySchema.safeParse(zero).success).toBe(false);
  });
});

describe('public quote (D3313)', () => {
  it('accepts a quote whose reasons are all public', () => {
    expect(publicQuoteSchema.safeParse(quoteFixture()).success).toBe(true);
  });

  it.each(['channel', 'audience', 'per_buyer_limit'])(
    'refuses a skipped entry with the private reason %s',
    (reason) => {
      // Arrange
      const quote = { ...quoteFixture(), skipped: [{ offerId: '7300000000000000001', reason }] };
      // Act / Assert
      expect(publicQuoteSchema.safeParse(quote).success).toBe(false);
    },
  );

  it('refuses a rejected code with the private reason per_buyer_limit', () => {
    const quote = { ...quoteFixture(), rejectedCodes: [{ code: 'SALE', reason: 'per_buyer_limit' }] };
    expect(publicQuoteSchema.safeParse(quote).success).toBe(false);
  });

  it('splits every engine reason into public or private, so a new reason must be classified', () => {
    expect([...PUBLIC_SKIP_REASONS, ...PRIVATE_SKIP_REASONS].sort()).toEqual([...SKIP_REASONS].sort());
    expect([...PUBLIC_CODE_REJECT_REASONS, ...PRIVATE_CODE_REJECT_REASONS].sort()).toEqual(
      [...CODE_REJECT_REASONS].sort(),
    );
  });

  it('lists no private reason as public', () => {
    expect(PUBLIC_SKIP_REASONS).not.toContain('channel');
    expect(PUBLIC_SKIP_REASONS).not.toContain('audience');
    expect(PUBLIC_SKIP_REASONS).not.toContain('per_buyer_limit');
    expect(PUBLIC_CODE_REJECT_REASONS).not.toContain('per_buyer_limit');
    expect(PUBLIC_CODE_REJECT_REASONS).toContain('not_eligible');
  });
});

describe('checkout strings', () => {
  const english: Readonly<Record<string, unknown>> = storefrontMessages('en');

  it('has a message for every public code reason', () => {
    const missing = PUBLIC_CODE_REJECT_REASONS.filter(
      (reason) => english[`checkout.codeRejected.${reason}`] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('has a message for every field error', () => {
    const keys = Object.entries(CHECKOUT_FIELD_ERRORS).flatMap(([field, reasons]) =>
      reasons.map((reason) => `checkout.error.${field}.${reason}`),
    );
    expect(keys.filter((key) => english[key] === undefined)).toEqual([]);
  });
});

describe('formatMoney (D3312)', () => {
  it.each(['ar', 'fr', 'en'] as const)('writes DZD in %s exactly as formatDzd', (locale) => {
    expect(formatMoney(locale, 1200, 'DZD')).toBe(formatDzd(locale, 1200));
  });

  it('writes another currency with its code', () => {
    expect(formatMoney('en', 1200, 'EUR')).toBe('1,200 EUR');
  });
});

describe('checkout routes', () => {
  it('declares the quote and province routes', () => {
    expect(STOREFRONT_API_ROUTES.shippingQuote).toBe('/store/shipping-quote');
    expect(STOREFRONT_API_ROUTES.cartQuote).toBe('/store/cart-quote');
    expect(STOREFRONT_API_ROUTES.provinces).toBe('/store/provinces');
    expect(storefrontApiPath('provinceByCode', '16')).toBe('/store/provinces/code/16');
  });

  it('declares the same-origin relay paths under /api/store', () => {
    expect(Object.values(STOREFRONT_RELAY_PATHS).every((path) => path.startsWith('/api/store/'))).toBe(true);
  });
});

describe('in-page checkout section settings (D3306)', () => {
  it('reads showNote and defaultDeliveryType', () => {
    const settings = inPageCheckoutSettingsOf({ showNote: true, defaultDeliveryType: 'desk' });
    expect(settings).toEqual({ showNote: true, defaultDeliveryType: 'desk' });
  });

  it('falls back to no note and home delivery for absent or unreadable values', () => {
    expect(inPageCheckoutSettingsOf({})).toEqual({ showNote: false, defaultDeliveryType: 'home' });
    expect(inPageCheckoutSettingsOf({ showNote: 'yes', defaultDeliveryType: 3 })).toEqual({
      showNote: false,
      defaultDeliveryType: 'home',
    });
  });
});
