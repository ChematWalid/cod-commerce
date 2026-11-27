import { describe, expect, it } from 'vitest';
import { storefrontCartQuoteBodySchema } from '../../src/storefront/checkout';
import { BUYER_NOTE_MAX } from '../../src/storefront/checkout-constants';
import {
  orderQuoteMismatchSchema,
  publicOrderAcceptedSchema,
  publicOrderDraftSchema,
  quoteRequestOfDraft,
} from '../../src/storefront/order-submit';
import { quoteFixture } from './quote-fixture';

/** The cart-quote body the form sent, whose answer carried the token the draft submits. */
const quotedBody = {
  lines: [
    { variantId: '12', quantity: 2 },
    { variantId: '40', quantity: 1 },
  ],
  destination: { provinceCode: '16', townOns: '1601', stopdesk: true },
  phone: '0551234567',
  codes: ['sale10'],
};

function draftInput(): Record<string, unknown> {
  return {
    quoteToken: 'qt1.payload.signature',
    stopdesk: true,
    codes: ['sale10'],
    deviceId: '3f1c2a4e-8b7d-4c6e-9f00-1a2b3c4d5e6f',
    pageMs: 42_000,
    formMs: 18_000,
    overweightFeeShown: 0,
    orderClient: { name: 'Amina B.', phone: '05 51 23 45 67', provinceCode: '16', townOns: '1601' },
    orderItems: quotedBody.lines,
    storeId: '7300000000000000009',
    businessId: '7300000000000000008',
  };
}

describe('public order draft (D3309)', () => {
  it('parses a draft, normalises the phone and drops storeId and businessId', () => {
    // Act
    const draft = publicOrderDraftSchema.parse(draftInput());
    // Assert
    expect(draft.orderClient.phone).toBe('+213551234567');
    expect(draft).not.toHaveProperty('storeId');
    expect(draft).not.toHaveProperty('businessId');
  });

  it('refuses a landline phone', () => {
    // Arrange
    const input = draftInput();
    input['orderClient'] = { ...(input['orderClient'] as object), phone: '021234567' };
    // Act / Assert
    expect(publicOrderDraftSchema.safeParse(input).success).toBe(false);
  });

  it('refuses a note one character past the limit and accepts one at it', () => {
    // Arrange
    const client = draftInput()['orderClient'] as object;
    const withNote = (note: string): Record<string, unknown> => ({ ...draftInput(), orderClient: { ...client, note } });
    // Act / Assert
    expect(publicOrderDraftSchema.safeParse(withNote('n'.repeat(BUYER_NOTE_MAX + 1))).success).toBe(false);
    expect(publicOrderDraftSchema.safeParse(withNote('n'.repeat(BUYER_NOTE_MAX))).success).toBe(true);
    expect(publicOrderDraftSchema.safeParse(withNote('n'.repeat(2001))).success).toBe(false);
  });

  it('refuses a negative timing and a device id that is no uuid', () => {
    expect(publicOrderDraftSchema.safeParse({ ...draftInput(), formMs: -1 }).success).toBe(false);
    expect(publicOrderDraftSchema.safeParse({ ...draftInput(), deviceId: 'device-1' }).success).toBe(false);
  });
});

describe('quoteRequestOfDraft', () => {
  it('rebuilds exactly the cart-quote request that produced the token, codes included', () => {
    // Arrange
    const draft = publicOrderDraftSchema.parse(draftInput());
    // Act
    const rebuilt = quoteRequestOfDraft(draft);
    // Assert
    expect(rebuilt).toEqual(storefrontCartQuoteBodySchema.parse(quotedBody));
    expect(storefrontCartQuoteBodySchema.parse(rebuilt)).toEqual(rebuilt);
  });
});

describe('order answers', () => {
  it('reads an accepted mock order', () => {
    const accepted = { id: '1', status: 'pending', total: 5100, shippingPrice: 600, subtotal: 4500, discountTotal: 0 };
    expect(publicOrderAcceptedSchema.parse({ ...accepted, mock: true })).toEqual({ ...accepted, mock: true });
  });

  it('reads a quote mismatch with its fresh public quote', () => {
    const parsed = orderQuoteMismatchSchema.safeParse({ code: 'QUOTE_MISMATCH', quote: quoteFixture() });
    expect(parsed.success).toBe(true);
  });
});
