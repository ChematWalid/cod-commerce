import { describe, expect, it } from 'vitest';
import {
  DOMAIN_EVENT_NAMES,
  generateCodesInputSchema,
  MAX_CODES_PER_ADD,
  MONEY_MAX_DZD,
  OFFER_PAGE_MAX,
  OFFER_PAGE_SIZE,
  offerListOptionsSchema,
  offerPreviewInputSchema,
  PREVIEW_DELIVERY_FEE,
  PREVIEW_SAMPLE_PRICE,
  PUBLISH_PROBLEMS,
} from '../../src/index';

const draft = { kind: 'quantity', title: 'Two for less', config: { priceMode: 'percent', tiers: [] } };

describe('offerListOptionsSchema', () => {
  it('reads an empty query as the first page of every offer', () => {
    expect(offerListOptionsSchema.parse({})).toEqual({ skip: 0, take: OFFER_PAGE_SIZE });
  });

  it('reads REST query strings and unset GraphQL fields', () => {
    const options = offerListOptionsSchema.parse({
      status: 'active',
      kind: 'bxgy',
      productId: '42',
      skip: '20',
      take: '10',
    });

    expect(options).toEqual({ status: 'active', kind: 'bxgy', productId: '42', skip: 20, take: 10 });
    expect(offerListOptionsSchema.parse({ status: null, productId: '' })).toEqual({ skip: 0, take: OFFER_PAGE_SIZE });
  });

  it('refuses a page size above 50', () => {
    expect(offerListOptionsSchema.safeParse({ take: OFFER_PAGE_MAX + 1 }).success).toBe(false);
    expect(offerListOptionsSchema.safeParse({ skip: -1 }).success).toBe(false);
  });

  it('refuses an unknown status and a product id that is not a core id', () => {
    expect(offerListOptionsSchema.safeParse({ status: 'live' }).success).toBe(false);
    expect(offerListOptionsSchema.safeParse({ productId: '2147483648' }).success).toBe(false);
  });
});

describe('generateCodesInputSchema', () => {
  it('fills an empty prefix and no per-code limit', () => {
    expect(generateCodesInputSchema.parse({ count: 10 })).toEqual({ count: 10, prefix: '', usageLimit: null });
  });

  it('refuses a generated-code prefix with lower case or 9 characters', () => {
    expect(generateCodesInputSchema.safeParse({ count: 1, prefix: 'Promo' }).success).toBe(false);
    expect(generateCodesInputSchema.safeParse({ count: 1, prefix: 'SUMMER202' }).success).toBe(false);
    expect(generateCodesInputSchema.safeParse({ count: 1, prefix: 'SUMMER26' }).success).toBe(true);
  });

  it('refuses a count outside 1 to the add cap and a per-code limit of 0', () => {
    expect(generateCodesInputSchema.safeParse({ count: 0 }).success).toBe(false);
    expect(generateCodesInputSchema.safeParse({ count: MAX_CODES_PER_ADD + 1 }).success).toBe(false);
    expect(generateCodesInputSchema.safeParse({ count: 1, usageLimit: 0 }).success).toBe(false);
  });
});

describe('offerPreviewInputSchema', () => {
  it('defaults the preview sample price to 4900', () => {
    const input = offerPreviewInputSchema.parse({ offer: draft });

    expect(input.samplePrice).toBe(PREVIEW_SAMPLE_PRICE);
    expect(PREVIEW_SAMPLE_PRICE).toBe(4900);
    expect(input.sampleDeliveryFee).toBe(PREVIEW_DELIVERY_FEE);
    expect(input.offer.targets).toEqual([]);
  });

  it('refuses a sample price of 0 and a delivery fee above the money range', () => {
    expect(offerPreviewInputSchema.safeParse({ offer: draft, samplePrice: 0 }).success).toBe(false);
    expect(offerPreviewInputSchema.safeParse({ offer: draft, sampleDeliveryFee: MONEY_MAX_DZD + 1 }).success).toBe(
      false,
    );
  });
});

describe('offers admin lists', () => {
  it('names every publish problem once', () => {
    expect(PUBLISH_PROBLEMS).toEqual(['title', 'targets', 'dates']);
  });

  it('lists offer.applied among the domain event names', () => {
    expect(DOMAIN_EVENT_NAMES.OfferApplied).toBe('offer.applied');
  });
});
