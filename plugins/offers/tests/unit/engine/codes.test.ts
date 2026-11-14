import { describe, expect, it } from 'vitest';
import { normaliseCode, resolveCodes } from '../../../domain/engine/codes';
import type { Offer } from '../../../domain/offer';
import type { CodeEntry } from '../../../domain/snapshot';
import { A_BUYER, aSnapshot } from '../../support/builders';
import { aProductDiscount, quoteOf } from '../../support/pipeline';

/** The code-method product discount 7002 (10 % on product 1) behind code `INFLU10`. */
const influencerOffer = (overrides: Partial<Offer> = {}) => aProductDiscount({ method: 'codes', ...overrides });

const INFLU10: CodeEntry = { offerId: '7002', usageLimit: null, usageCount: 0 };

/** The store's codes: `INFLU10` (and any extra entries) for offer 7002. */
const codes = (extra: Record<string, CodeEntry> = {}) =>
  new Map<string, CodeEntry>([['INFLU10', INFLU10], ...Object.entries(extra)]);

describe('discount codes', () => {
  it('normalises case and spaces', () => {
    // Act
    const quote = quoteOf({ offers: [influencerOffer()], codes: codes() }, { codes: [' influ10 '] });

    // Assert
    expect(normaliseCode(' influ10 ')).toBe('INFLU10');
    expect(quote.applied).toEqual([{ offerId: '7002', kind: 'product_discount', amount: 490, code: 'INFLU10' }]);
    expect(quote.rejectedCodes).toEqual([]);
  });

  it('rejects a repeated code as duplicate', () => {
    // Act
    const quote = quoteOf({ offers: [influencerOffer()], codes: codes() }, { codes: ['INFLU10', ' influ10'] });

    // Assert
    expect(quote.applied).toHaveLength(1);
    expect(quote.rejectedCodes).toEqual([{ code: 'INFLU10', reason: 'duplicate' }]);
  });

  it('rejects an unknown code as not_found', () => {
    // Act
    const resolution = resolveCodes(['nope'], aSnapshot({ offers: [influencerOffer()], codes: codes() }));

    // Assert
    expect(resolution.rejected).toEqual([{ code: 'NOPE', reason: 'not_found' }]);
    expect(resolution.activated.size).toBe(0);
  });

  it('rejects a code past its own limit as code_limit', () => {
    // Arrange
    const used = codes({ INFLU10: { offerId: '7002', usageLimit: 5, usageCount: 5 } });

    // Act
    const resolution = resolveCodes(['INFLU10'], aSnapshot({ offers: [influencerOffer()], codes: used }));

    // Assert
    expect(resolution.rejected).toEqual([{ code: 'INFLU10', reason: 'code_limit' }]);
  });

  it('rejects a code of a paused offer as inactive', () => {
    // Arrange
    const paused = aSnapshot({ offers: [influencerOffer({ status: 'paused' })], codes: codes() });
    const missing = aSnapshot({ offers: [], codes: codes() });

    // Act
    const fromPaused = resolveCodes(['INFLU10'], paused);
    const fromMissing = resolveCodes(['INFLU10'], missing);

    // Assert
    expect(fromPaused.rejected).toEqual([{ code: 'INFLU10', reason: 'inactive' }]);
    expect(fromMissing.rejected).toEqual([{ code: 'INFLU10', reason: 'inactive' }]);
  });

  it('rejects a code whose offer targets nothing in the cart as no_matching_items', () => {
    // Arrange
    const offer = influencerOffer({ targets: [{ role: 'buy', refType: 'product', refId: '2' }] });

    // Act
    const quote = quoteOf({ offers: [offer], codes: codes() }, { codes: ['INFLU10'] });

    // Assert
    expect(quote.rejectedCodes).toEqual([{ code: 'INFLU10', reason: 'no_matching_items' }]);
    expect(quote.skipped).toEqual([]);
  });

  it('rejects a code whose offer reached its total limit as usage_limit', () => {
    // Arrange
    const offer = influencerOffer({ totalUsageLimit: 10, usageCount: 10 });

    // Act
    const quote = quoteOf({ offers: [offer], codes: codes() }, { codes: ['INFLU10'] });

    // Assert
    expect(quote.rejectedCodes).toEqual([{ code: 'INFLU10', reason: 'usage_limit' }]);
  });

  it('rejects a code whose per-buyer limit is reached as per_buyer_limit', () => {
    // Arrange
    const snapshot = {
      offers: [influencerOffer({ perBuyerLimit: 1 })],
      codes: codes(),
      perBuyerUsage: new Map([['7002', 1]]),
    };

    // Act
    const quote = quoteOf(snapshot, { codes: ['INFLU10'], buyer: A_BUYER });

    // Assert
    expect(quote.rejectedCodes).toEqual([{ code: 'INFLU10', reason: 'per_buyer_limit' }]);
  });

  it('rejects a code of an offer for another wilaya as not_eligible', () => {
    // Arrange
    const offer = influencerOffer({
      eligibility: { audience: 'everyone', channels: [], wilayas: ['31'], deliveryMethods: [] },
    });

    // Act
    const quote = quoteOf({ offers: [offer], codes: codes() }, { codes: ['INFLU10'] });

    // Assert
    expect(quote.rejectedCodes).toEqual([{ code: 'INFLU10', reason: 'not_eligible' }]);
  });

  it('applies a valid code exactly once', () => {
    // Arrange
    const twoCodes = codes({ INSTA10: INFLU10 });

    // Act
    const quote = quoteOf({ offers: [influencerOffer()], codes: twoCodes }, { codes: ['INFLU10', 'INSTA10'] });

    // Assert
    expect(quote.lines[0]?.unitPrice).toBe(4_410);
    expect(quote.applied).toHaveLength(1);
    expect(quote.rejectedCodes).toEqual([{ code: 'INSTA10', reason: 'duplicate' }]);
  });

  it('ignores a code-method offer when no code is given', () => {
    // Act
    const quote = quoteOf({ offers: [influencerOffer()], codes: codes() });

    // Assert
    expect(quote.applied).toEqual([]);
    expect(quote.skipped).toEqual([]);
    expect(quote.rejectedCodes).toEqual([]);
  });
});
