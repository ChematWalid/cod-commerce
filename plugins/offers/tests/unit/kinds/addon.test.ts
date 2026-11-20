import { MAX_ADDON_PRODUCTS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { addonCalculator } from '../../../domain/kinds/addon';
import { aLine } from '../../support/builders';
import { ADDON_ID, ADDON_KEY, ADDON_TARGET, anAddon, anAddonConfig, anAddonOffer } from '../../support/addon';
import { lineOf, shapeOf } from '../../support/bxgy';
import { anOrderDiscount, aProductDiscount, quoteOf } from '../../support/pipeline';

const BUY_PRODUCT_1 = { role: 'buy' as const, refType: 'product' as const, refId: '1' };

/** A cart of one piece of variant 11 (product 1, 4,900) with the add-ons given. */
const withAddons = (...addons: ReturnType<typeof anAddon>[]) => ({ lines: [aLine()], addons });

describe('addonCalculator: pricing', () => {
  it('adds an accepted add-on at its fixed price', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer()] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 1, unitPrice: 4_900 },
      { key: ADDON_KEY, quantity: 1, unitPrice: 1_200 },
    ]);
    expect(lineOf(quote.lines, ADDON_KEY)).toMatchObject({
      addonOf: ADDON_ID,
      parentVariantId: null,
      variantId: '21',
      productId: '3',
      originalPrice: 2_000,
      totalPrice: 1_200,
      discounts: [{ offerId: ADDON_ID, kind: 'addon', amount: 800 }],
    });
    expect(quote.subtotal).toBe(6_100);
    expect(quote.applied).toEqual([{ offerId: ADDON_ID, kind: 'addon', amount: 800 }]);
    expect(quote.rejectedAddons).toEqual([]);
  });

  it('adds nothing for a declined add-on', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ condition: 'targets' }, { targets: [ADDON_TARGET, BUY_PRODUCT_1] })] };

    // Act
    const quote = quoteOf(snapshot, withAddons());

    // Assert
    expect(shapeOf(quote.lines)).toEqual([{ key: '11', quantity: 1, unitPrice: 4_900 }]);
    expect(quote).toMatchObject({ subtotal: 4_900, applied: [], skipped: [], rejectedAddons: [] });
  });

  it('takes 20 percent off the add-on list price', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ price: { mode: 'percent', value: 20 } })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(lineOf(quote.lines, ADDON_KEY)).toMatchObject({ unitPrice: 1_600, totalPrice: 1_600 });
  });

  it('caps a fixed price at the list price and still adds the add-on', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ price: { mode: 'fixed', value: 2_500 } })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(lineOf(quote.lines, ADDON_KEY)).toMatchObject({ unitPrice: 2_000, discounts: [] });
    expect(quote.applied).toEqual([{ offerId: ADDON_ID, kind: 'addon', amount: 0 }]);
  });

  it('never takes an amount off below 0', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ price: { mode: 'amount_off', value: 3_000 } })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon({ quantity: 2 })));

    // Assert
    expect(lineOf(quote.lines, ADDON_KEY)).toMatchObject({ quantity: 2, unitPrice: 0, totalPrice: 0 });
  });

  it('clamps add-on pieces to the per-order cap', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ maxPiecesPerOrder: 2 })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon({ quantity: 5 })));

    // Assert
    expect(lineOf(quote.lines, ADDON_KEY)).toMatchObject({ quantity: 2, totalPrice: 2_400 });
  });

  it('keeps line offers off the add-on line', () => {
    // Arrange
    const discount = aProductDiscount({ config: { valueType: 'percent', value: 10, appliesTo: 'all' } });
    const snapshot = { offers: [anAddonOffer(), discount] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 1, unitPrice: 4_410 },
      { key: ADDON_KEY, quantity: 1, unitPrice: 1_200 },
    ]);
  });
});

describe('addonCalculator: condition and parent', () => {
  it('sets parentVariantId to null for any order', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({}, { targets: [ADDON_TARGET, BUY_PRODUCT_1] })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(lineOf(quote.lines, ADDON_KEY).parentVariantId).toBeNull();
  });

  it('rides with the smallest buy line id for a targets condition', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer({ condition: 'targets' }, { targets: [ADDON_TARGET, BUY_PRODUCT_1] })] };
    const lines = [aLine({ variantId: '102' }), aLine({ variantId: '11' })];

    // Act
    const quote = quoteOf(snapshot, { lines, addons: [anAddon()] });

    // Assert
    expect(lineOf(quote.lines, ADDON_KEY).parentVariantId).toBe('11');
  });

  it('needs a buy line for a targets condition', () => {
    // Arrange
    const buyProduct9 = { ...BUY_PRODUCT_1, refId: '9' };
    const snapshot = { offers: [anAddonOffer({ condition: 'targets' }, { targets: [ADDON_TARGET, buyProduct9] })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(shapeOf(quote.lines)).toEqual([{ key: '11', quantity: 1, unitPrice: 4_900 }]);
    expect(quote.rejectedAddons).toEqual([{ offerId: ADDON_ID, variantId: '21', reason: 'not_eligible' }]);
    expect(quote.applied).toEqual([]);
    expect(quote.available).toBe(true);
  });

  it('rejects an add-on of an offer the buyer is not eligible for as not_eligible', () => {
    // Arrange
    const forFirstBuyers = { audience: 'first' as const, channels: [], wilayas: [], deliveryMethods: [] };
    const snapshot = { offers: [anAddonOffer({}, { eligibility: forFirstBuyers })] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: ADDON_ID, variantId: '21', reason: 'not_eligible' }]);
    expect(quote.skipped).toEqual([{ offerId: ADDON_ID, reason: 'audience' }]);
  });
});

describe('addonCalculator: combination', () => {
  it('combines an add-on with a non-combinable order discount', () => {
    // Arrange
    const snapshot = { offers: [anAddonOffer(), anOrderDiscount()] };

    // Act
    const quote = quoteOf(snapshot, withAddons(anAddon()));

    // Assert
    expect(quote.applied.map(({ offerId }) => offerId).sort()).toEqual(['7003', ADDON_ID]);
    expect(quote.discounts).toEqual([{ offerId: '7003', kind: 'order_discount', amount: 610 }]);
    expect(quote.total).toBe(6_100 - 610);
  });

  it('counts the add-on in the order minimum', () => {
    // Arrange
    const minimum = { type: 'amount', min: 6_000 };
    const discount = anOrderDiscount({ config: { valueType: 'fixed', value: 500, minimum } });
    const snapshot = { offers: [anAddonOffer(), discount] };

    // Act
    const withAddon = quoteOf(snapshot, withAddons(anAddon()));
    const without = quoteOf(snapshot, withAddons());

    // Assert
    expect(withAddon.discounts).toEqual([{ offerId: '7003', kind: 'order_discount', amount: 500 }]);
    expect(without.discounts).toEqual([]);
  });
});

describe('addonCalculator: hooks', () => {
  it('needs add-on targets, and buy targets for a targets condition', () => {
    // Arrange
    const anyOrder = anAddonConfig();
    const targets = anAddonConfig({ condition: 'targets' });

    // Act
    const rules = [addonCalculator.targetRules(anyOrder), addonCalculator.targetRules(targets)];

    // Assert
    expect(rules).toEqual([
      { allowed: ['addon', 'buy'], required: ['addon'], maxPerRole: { addon: MAX_ADDON_PRODUCTS } },
      { allowed: ['addon', 'buy'], required: ['addon', 'buy'], maxPerRole: { addon: MAX_ADDON_PRODUCTS } },
    ]);
  });

  it('previews one piece with the add-on accepted, and offers it on its placement', () => {
    // Arrange
    const config = anAddonConfig({ placement: 'thank_you' });

    // Act
    const carts = addonCalculator.previewCarts?.(config);
    const placement = addonCalculator.addonPlacement?.(config);

    // Assert
    expect(carts).toEqual([{ pieces: 1, withGet: false, withAddon: true }]);
    expect(placement).toBe('thank_you');
    expect(addonCalculator).toMatchObject({ kind: 'addon', combinationClass: 'product', combinesAlways: true });
  });
});
