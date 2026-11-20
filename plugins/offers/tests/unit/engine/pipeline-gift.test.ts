import { describe, expect, it } from 'vitest';
import { aLine } from '../../support/builders';
import { aBxgyOffer, BXGY_ID, lineOf, shapeOf } from '../../support/bxgy';
import { aProductDiscount, aQuantityOffer, HOME_800, quoteOf } from '../../support/pipeline';

const GIFT_KEY = `11:gift:${BXGY_ID}`;
const COMBINES_WITH_PRODUCTS = { order: false, product: true, delivery: false };
const THREE_PIECES = { lines: [aLine({ quantity: 3 })] };

describe('priceCart: gift lines', () => {
  it('does not let a product discount touch the gift line', () => {
    // Arrange
    const offers = [
      aBxgyOffer({}, { combinesWith: COMBINES_WITH_PRODUCTS }),
      aProductDiscount({ combinesWith: COMBINES_WITH_PRODUCTS }),
    ];

    // Act
    const quote = quoteOf({ offers }, THREE_PIECES);

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 2, unitPrice: 4_410 },
      { key: GIFT_KEY, quantity: 1, unitPrice: 0 },
    ]);
    expect(lineOf(quote.lines, GIFT_KEY).discounts).toEqual([{ offerId: BXGY_ID, kind: 'bxgy', amount: 4_900 }]);
    expect(quote.applied).toEqual([
      { offerId: BXGY_ID, kind: 'bxgy', amount: 4_900 },
      { offerId: '7002', kind: 'product_discount', amount: 980 },
    ]);
  });

  it("counts gift units in the tier pieces and keeps every line's total exact", () => {
    // Arrange
    const offers = [
      aQuantityOffer({ combinesWith: COMBINES_WITH_PRODUCTS }),
      aBxgyOffer({}, { combinesWith: COMBINES_WITH_PRODUCTS }),
    ];

    // Act
    const quote = quoteOf({ offers, shipping: HOME_800 }, THREE_PIECES);

    // Assert
    expect(shapeOf(quote.lines)).toEqual([
      { key: '11', quantity: 2, unitPrice: 4_165 },
      { key: GIFT_KEY, quantity: 1, unitPrice: 0 },
    ]);
    expect(quote.lines.every((line) => line.totalPrice === line.unitPrice * line.quantity)).toBe(true);
    expect(lineOf(quote.lines, '11').discounts).toEqual([{ offerId: '7001', kind: 'quantity', amount: 1_470 }]);
    expect(lineOf(quote.lines, GIFT_KEY).discounts).toEqual([
      { offerId: '7001', kind: 'quantity', amount: 735 },
      { offerId: BXGY_ID, kind: 'bxgy', amount: 4_165 },
    ]);
    expect(quote.delivery.waived).toBe(true);
    expect(quote.applied).toEqual([
      { offerId: '7001', kind: 'quantity', amount: 3_005 },
      { offerId: BXGY_ID, kind: 'bxgy', amount: 4_165 },
    ]);
    expect([quote.subtotal, quote.total, quote.savings]).toEqual([8_330, 8_330, 7_170]);
  });

  it('ranks bxgy by the gifted value against a non-combinable product discount', () => {
    // Arrange
    const offers = [aProductDiscount(), aBxgyOffer()];

    // Act
    const quote = quoteOf({ offers }, THREE_PIECES);

    // Assert
    expect(quote.applied).toEqual([{ offerId: BXGY_ID, kind: 'bxgy', amount: 4_900 }]);
    expect(quote.skipped).toEqual([{ offerId: '7002', reason: 'not_combinable' }]);
  });

  it('signs the gift line in the token lines with its offer, beside the paid line of the same variant', () => {
    // Arrange
    const offers = [aBxgyOffer()];

    // Act
    const quote = quoteOf({ offers }, THREE_PIECES);

    // Assert
    expect(quote.tokenLines).toEqual([
      { variantId: '11', qty: 2, unitPrice: 4_900, originalPrice: 4_900, offerIds: [] },
      { variantId: '11', qty: 1, unitPrice: 0, originalPrice: 4_900, offerIds: [BXGY_ID], g: BXGY_ID },
    ]);
    expect(quote.tokenUses).toEqual([{ offerId: BXGY_ID }]);
  });

  it('rejects a code of a gift offer that names no cart line as no_matching_items', () => {
    // Arrange
    const offer = aBxgyOffer({}, { method: 'codes' });
    const codes = new Map([['GIFT3', { offerId: BXGY_ID, usageLimit: null, usageCount: 0 }]]);
    const cart = { lines: [aLine({ variantId: '21', productId: '2', quantity: 3 })], codes: ['GIFT3'] };

    // Act
    const quote = quoteOf({ offers: [offer], codes }, cart);

    // Assert
    expect(quote.rejectedCodes).toEqual([{ code: 'GIFT3', reason: 'no_matching_items' }]);
  });
});
