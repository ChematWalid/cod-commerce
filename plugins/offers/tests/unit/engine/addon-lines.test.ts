import { describe, expect, it } from 'vitest';
import { aLine } from '../../support/builders';
import { ADDON_ID, ADDON_KEY, anAddon, anAddonOffer } from '../../support/addon';
import { aProductDiscount, quoteOf } from '../../support/pipeline';

/** A cart of one piece of variant 11 at 4,900 with the add-ons given. */
const withAddons = (...addons: ReturnType<typeof anAddon>[]) => ({ lines: [aLine()], addons });

const keysOf = (lines: readonly { key: string }[]) => lines.map(({ key }) => key);

describe('add-on requests: not offered', () => {
  it('rejects an add-on of an offer the store does not have as not_offered', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer()] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon({ offerId: '9999' })));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: '9999', variantId: '21', reason: 'not_offered' }]);
    expect(keysOf(quote.lines)).toEqual(['11']);
  });

  it('rejects an add-on naming an offer that offers no add-on as not_offered', () => {
    // Arrange
    const snapshot = { offers: [aProductDiscount()] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon({ offerId: '7002' })));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: '7002', variantId: '21', reason: 'not_offered' }]);
  });

  it('rejects a variant that is not among the add-on targets as not_offered', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer()] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon({ variantId: '22' })));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: ADDON_ID, variantId: '22', reason: 'not_offered' }]);
    expect(quote.applied).toEqual([]);
  });

  it('rejects an add-on of a paused offer as not_offered', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({}, { status: 'paused' })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: ADDON_ID, variantId: '21', reason: 'not_offered' }]);
  });

  it('rejects an add-on for a thank-you placement at checkout as not_offered', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ placement: 'thank_you' })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: ADDON_ID, variantId: '21', reason: 'not_offered' }]);
    expect(keysOf(quote.lines)).toEqual(['11']);
  });

  it('prices a thank-you add-on in the thank-you placement', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ placement: 'thank_you' })] };

    // Act
    const quote = quoteOf(snapshot, { ...withAddons(anAddon()), addonPlacement: 'thank_you' });

    // Assert
    expect(keysOf(quote.lines)).toEqual(['11', ADDON_KEY]);
    expect(quote.rejectedAddons).toEqual([]);
  });
});

describe('add-on requests: availability and token', () => {
  it('rejects an unavailable add-on variant without making the quote unavailable', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer()] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon({ priced: null })));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: ADDON_ID, variantId: '21', reason: 'unavailable' }]);
    expect(quote).toMatchObject({ available: true, unavailableVariantIds: [], subtotal: 4_900 });
  });

  it('lists rejected add-ons in request order', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer()] };
    const addons = [anAddon({ variantId: '23', priced: null }), anAddon({ offerId: '9999' }), anAddon()];

    // Act
    const quote = quoteOf(snapshot, withAddons(...addons));

    // Assert
    expect(quote.rejectedAddons).toEqual([
      { offerId: ADDON_ID, variantId: '23', reason: 'unavailable' },
      { offerId: '9999', variantId: '21', reason: 'not_offered' },
    ]);
  });

  it('signs the add-on lines in the token add-ons, never in the token lines', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer()] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon({ quantity: 2 })));

    // Assert
    expect(quote.tokenLines.map(({ variantId }) => variantId)).toEqual(['11']);
    expect(quote.tokenAddons).toEqual([
      { offerId: ADDON_ID, variantId: '21', qty: 2, unitPrice: 1_200, parentVariantId: null },
    ]);
    expect(quote.tokenUses).toEqual([{ offerId: ADDON_ID }]);
  });
});
