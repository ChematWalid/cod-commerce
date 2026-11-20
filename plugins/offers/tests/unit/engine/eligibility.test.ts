import type { OfferEligibility } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { checkEligibility } from '../../../domain/engine/eligibility';
import type { Offer } from '../../../domain/offer';
import { A_BUYER, aCart, anOffer, aSnapshot, at } from '../../support/builders';

/** An offer whose eligibility is `overrides` over "everyone, everywhere". */
function offerFor(overrides: Partial<OfferEligibility>, offer: Partial<Offer> = {}): Offer {
  return anOffer({
    eligibility: { audience: 'everyone', channels: [], wilayas: [], deliveryMethods: [], ...overrides },
    ...offer,
  });
}

describe('checkEligibility', () => {
  it('applies an offer that every rule lets through', () => {
    // Arrange
    const offer = offerFor({ channels: ['storefront'], wilayas: ['16'], deliveryMethods: ['home'] });

    // Act
    const result = checkEligibility(offer, aCart(), aSnapshot());

    // Assert
    expect(result).toBeNull();
  });

  it('skips an offer before startsAt as not_started', () => {
    // Arrange
    const offer = anOffer({ startsAt: at(30) });

    // Act
    const result = checkEligibility(offer, aCart(), aSnapshot());

    // Assert
    expect(result).toBe('not_started');
  });

  it('skips an offer for another channel', () => {
    // Arrange
    const offer = offerFor({ channels: ['landing_page'] });

    // Act
    const result = checkEligibility(offer, aCart({ channel: 'storefront' }), aSnapshot());

    // Assert
    expect(result).toBe('channel');
  });

  it('treats empty channels as all', () => {
    // Arrange
    const offer = offerFor({ channels: [] });

    // Act
    const results = (['storefront', 'order_form_app', 'app'] as const).map((channel) =>
      checkEligibility(offer, aCart({ channel }), aSnapshot()),
    );

    // Assert
    expect(results).toEqual([null, null, null]);
  });

  it('skips an offer for another wilaya', () => {
    // Arrange
    const offer = offerFor({ wilayas: ['31'] });

    // Act
    const result = checkEligibility(
      offer,
      aCart({ destination: { provinceCode: '16', stopdesk: false } }),
      aSnapshot(),
    );

    // Assert
    expect(result).toBe('wilaya');
  });

  it('skips a wilaya-limited offer when no destination is given', () => {
    // Arrange
    const offer = offerFor({ wilayas: ['16'] });

    // Act
    const result = checkEligibility(offer, aCart({ destination: null }), aSnapshot());

    // Assert
    expect(result).toBe('wilaya');
  });

  it('skips a home-only offer for a desk delivery as delivery_method', () => {
    // Arrange
    const offer = offerFor({ deliveryMethods: ['home'] });

    // Act
    const result = checkEligibility(offer, aCart({ destination: { provinceCode: '16', stopdesk: true } }), aSnapshot());

    // Assert
    expect(result).toBe('delivery_method');
  });

  it('skips a method-limited offer when no destination is given', () => {
    // Arrange
    const offer = offerFor({ deliveryMethods: ['desk'] });

    // Act
    const result = checkEligibility(offer, aCart({ destination: null }), aSnapshot());

    // Assert
    expect(result).toBe('delivery_method');
  });

  it('skips a first-order offer for a buyer with one order as audience', () => {
    // Arrange
    const offer = offerFor({ audience: 'first' });

    // Act
    const result = checkEligibility(offer, aCart({ buyer: A_BUYER }), aSnapshot({ buyerOrderCount: 1 }));

    // Assert
    expect(result).toBe('audience');
  });

  it('applies a first-order offer to a buyer without orders', () => {
    // Arrange
    const offer = offerFor({ audience: 'first' });

    // Act
    const result = checkEligibility(offer, aCart({ buyer: A_BUYER }), aSnapshot({ buyerOrderCount: 0 }));

    // Assert
    expect(result).toBeNull();
  });

  it('skips a returning-buyer offer for a first-time buyer as audience', () => {
    // Arrange
    const offer = offerFor({ audience: 'returning' });

    // Act
    const result = checkEligibility(offer, aCart({ buyer: A_BUYER }), aSnapshot({ buyerOrderCount: 0 }));

    // Assert
    expect(result).toBe('audience');
  });

  it('applies an everyone offer without a phone', () => {
    // Arrange
    const offer = offerFor({ audience: 'everyone' });

    // Act
    const result = checkEligibility(offer, aCart({ buyer: null }), aSnapshot({ buyerOrderCount: null }));

    // Assert
    expect(result).toBeNull();
  });

  it('skips an audience offer without a phone', () => {
    // Arrange
    const offer = offerFor({ audience: 'returning' });

    // Act
    const result = checkEligibility(offer, aCart({ buyer: null }), aSnapshot({ buyerOrderCount: null }));

    // Assert
    expect(result).toBe('audience');
  });

  it('skips an offer whose total usage reached its limit', () => {
    // Arrange
    const offer = anOffer({ totalUsageLimit: 5, usageCount: 5 });

    // Act
    const result = checkEligibility(offer, aCart(), aSnapshot());

    // Assert
    expect(result).toBe('usage_limit');
  });

  it('reports the schedule before the channel when both fail', () => {
    // Arrange
    const offer = offerFor({ channels: ['app'] }, { endsAt: at(-1), startsAt: at(-30) });

    // Act
    const result = checkEligibility(offer, aCart({ channel: 'storefront' }), aSnapshot());

    // Assert
    expect(result).toBe('ended');
  });
});
