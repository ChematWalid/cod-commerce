import { describe, expect, it } from 'vitest';
import { bxgyCalculator } from '../../../domain/kinds/bxgy';
import { aLine, anOffer } from '../../support/builders';
import { aBxgyConfig, aBxgyOffer, BUY_P1_GET_P2, BXGY_ID, lineOf, shapeOf } from '../../support/bxgy';
import { aKindInput, aRunningLine } from '../../support/kind-input';
import { quoteOf } from '../../support/pipeline';

const GIFT_KEY = `11:gift:${BXGY_ID}`;

/** A cart of `quantity` pieces of variant 11 of product 1 at 4,900. */
const piecesOfProduct1 = (quantity: number) => ({ lines: [aLine({ quantity })] });

describe('bxgyCalculator: same items', () => {
  it('gifts one free unit of three', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer()] };

    // Act
    const quote = quoteOf(snapshot, piecesOfProduct1(3));

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 2, unitPrice: 4_900 },
      { key: GIFT_KEY, quantity: 1, unitPrice: 0 },
    ]);
    expect(lineOf(quote.lines, GIFT_KEY)).toMatchObject({
      giftOf: BXGY_ID,
      variantId: '11',
      productId: '1',
      originalPrice: 4_900,
      totalPrice: 0,
      discounts: [{ offerId: BXGY_ID, kind: 'bxgy', amount: 4_900 }],
    });
    expect(quote.subtotal).toBe(9_800);
    expect(quote.savings).toBe(4_900);
    expect(quote.applied).toEqual([{ offerId: BXGY_ID, kind: 'bxgy', amount: 4_900 }]);
  });

  it('caps gifts at max times per order', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer({ maxTimesPerOrder: 1 })] };

    // Act
    const quote = quoteOf(snapshot, piecesOfProduct1(6));

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 5, unitPrice: 4_900 },
      { key: GIFT_KEY, quantity: 1, unitPrice: 0 },
    ]);
  });

  it('gifts two units at six without a cap', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer()] };

    // Act
    const quote = quoteOf(snapshot, piecesOfProduct1(6));

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 4, unitPrice: 4_900 },
      { key: GIFT_KEY, quantity: 2, unitPrice: 0 },
    ]);
    expect(quote.total).toBe(19_600);
  });

  it('prices a 50 percent gift', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer({ gift: { mode: 'percent', value: 50 } })] };

    // Act
    const quote = quoteOf(snapshot, piecesOfProduct1(3));

    // Assert
    expect(lineOf(quote.lines, GIFT_KEY)).toMatchObject({ unitPrice: 2_450, totalPrice: 2_450 });
    expect(quote.subtotal).toBe(12_250);
  });

  it('takes a fixed amount off the gift and never goes below 0', () => {
    // Arrange
    const thousandOff = { offers: [aBxgyOffer({ gift: { mode: 'fixed', value: 1_000 } })] };
    const moreThanThePrice = { offers: [aBxgyOffer({ gift: { mode: 'fixed', value: 6_000 } })] };

    // Act
    const partly = quoteOf(thousandOff, piecesOfProduct1(3));
    const wholly = quoteOf(moreThanThePrice, piecesOfProduct1(3));

    // Assert
    expect(lineOf(partly.lines, GIFT_KEY).unitPrice).toBe(3_900);
    expect(lineOf(wholly.lines, GIFT_KEY).unitPrice).toBe(0);
    expect(wholly.applied).toEqual([{ offerId: BXGY_ID, kind: 'bxgy', amount: 4_900 }]);
  });

  it('gifts the cheapest matched unit on a mixed cart', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer()] };
    const lines = [aLine({ variantId: '11', quantity: 2 }), aLine({ variantId: '12', originalPrice: 3_900 })];

    // Act
    const quote = quoteOf(snapshot, { lines });

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 2, unitPrice: 4_900 },
      { key: `12:gift:${BXGY_ID}`, quantity: 1, unitPrice: 0 },
    ]);
    expect(quote.lines.every((line) => line.totalPrice === line.unitPrice * line.quantity)).toBe(true);
    expect(quote.subtotal).toBe(9_800);
  });

  it('skips no_tier_reached below buy plus get pieces', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer()] };

    // Act
    const quote = quoteOf(snapshot, piecesOfProduct1(2));

    // Assert
    expect(quote.skipped).toEqual([{ offerId: BXGY_ID, reason: 'no_tier_reached' }]);
    expect(shapeOf(quote.lines)).toEqual([{ key: '11', quantity: 2, unitPrice: 4_900 }]);
  });

  it('stays silent when no line is targeted', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer()] };

    // Act
    const quote = quoteOf(snapshot, { lines: [aLine({ variantId: '21', productId: '2', quantity: 3 })] });

    // Assert
    expect(quote.skipped).toEqual([]);
    expect(quote.applied).toEqual([]);
  });

  it('gifts from every product when it applies to all', () => {
    // Arrange
    const snapshot = { offers: [aBxgyOffer({ appliesTo: 'all' }, { targets: [] })] };
    const lines = [aLine({ variantId: '11', quantity: 2 }), aLine({ variantId: '21', productId: '2' })];

    // Act
    const quote = quoteOf(snapshot, { lines });

    // Assert
    expect(lineOf(quote.lines, `11:gift:${BXGY_ID}`).quantity).toBe(1);
  });
});

describe('bxgyCalculator: gift from the get targets', () => {
  const getOffer = (raw: Record<string, unknown> = {}) =>
    aBxgyOffer({ getFrom: 'targets', ...raw }, { targets: BUY_P1_GET_P2 });

  it('gifts a unit of another product', () => {
    // Arrange
    const snapshot = { offers: [getOffer()] };
    const lines = [
      aLine({ variantId: '11', quantity: 2 }),
      aLine({ variantId: '21', productId: '2', originalPrice: 3_000 }),
    ];

    // Act
    const quote = quoteOf(snapshot, { lines });

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 2, unitPrice: 4_900 },
      { key: `21:gift:${BXGY_ID}`, quantity: 1, unitPrice: 0 },
    ]);
    expect(lineOf(quote.lines, `21:gift:${BXGY_ID}`)).toMatchObject({ productId: '2', originalPrice: 3_000 });
    expect(quote.applied).toEqual([{ offerId: BXGY_ID, kind: 'bxgy', amount: 3_000 }]);
  });

  it('gifts at most the get units the cart holds and leaves the rest paid', () => {
    // Arrange
    const snapshot = { offers: [getOffer({ getQuantity: 2 })] };
    const lines = [
      aLine({ variantId: '11', quantity: 2 }),
      aLine({ variantId: '21', productId: '2', quantity: 3, originalPrice: 3_000 }),
    ];

    // Act
    const quote = quoteOf(snapshot, { lines });

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 2, unitPrice: 4_900 },
      { key: '21', quantity: 1, unitPrice: 3_000 },
      { key: `21:gift:${BXGY_ID}`, quantity: 2, unitPrice: 0 },
    ]);
  });

  it('suggests the gift when the get item is missing', () => {
    // Arrange
    const offer = anOffer({ id: BXGY_ID, kind: 'bxgy', targets: BUY_P1_GET_P2 });
    const input = aKindInput(aBxgyConfig({ getFrom: 'targets' }), [aRunningLine({ quantity: 2 })], { offer });

    // Act
    const suggestion = bxgyCalculator.suggest?.(input);
    const quote = quoteOf({ offers: [getOffer()] }, piecesOfProduct1(2));

    // Assert
    expect(suggestion).toEqual({ type: 'gift', offerId: BXGY_ID, units: 1 });
    expect(quote.suggestions).toEqual([{ type: 'gift', offerId: BXGY_ID, units: 1 }]);
  });

  it('suggests nothing once the earned gift is in the cart', () => {
    // Arrange
    const lines = [aLine({ variantId: '11', quantity: 2 }), aLine({ variantId: '21', productId: '2' })];

    // Act
    const quote = quoteOf({ offers: [getOffer()] }, { lines });

    // Assert
    expect(quote.suggestions).toEqual([]);
  });

  it('suggests nothing for a gift of the same items', () => {
    // Arrange
    const input = aKindInput(aBxgyConfig(), [aRunningLine({ quantity: 2 })]);

    // Act
    const suggestion = bxgyCalculator.suggest?.(input);

    // Assert
    expect(suggestion).toBeNull();
  });
});

describe('bxgyCalculator: registry hooks', () => {
  it('needs buy and get targets for a gift of other targeted products', () => {
    // Arrange
    const config = aBxgyConfig({ getFrom: 'targets' });

    // Act
    const rules = bxgyCalculator.targetRules(config);

    // Assert
    expect(rules).toEqual({ allowed: ['buy', 'get'], required: ['buy', 'get'] });
  });

  it('needs no target for a gift of the same items on every product', () => {
    // Arrange
    const config = aBxgyConfig({ appliesTo: 'all' });

    // Act
    const rules = bxgyCalculator.targetRules(config);

    // Assert
    expect(rules).toEqual({ allowed: ['buy', 'get'], required: [] });
  });

  it('previews one cart of buy plus get pieces', () => {
    // Arrange
    const config = aBxgyConfig({ buyQuantity: 3, getQuantity: 2, getFrom: 'targets' });

    // Act
    const carts = bxgyCalculator.previewCarts?.(config);

    // Assert
    expect(carts).toEqual([{ pieces: 5, withGet: true, getPieces: 2, withAddon: false }]);
  });
});
