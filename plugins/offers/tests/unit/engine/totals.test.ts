import { MONEY_MAX_DZD, type DeliveryBlock } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { deliveryBlock } from '../../../domain/engine/delivery';
import { totalsOf } from '../../../domain/engine/totals';
import { PricingTotalTooLargeError } from '../../../domain/errors';
import { aLine } from '../../support/builders';
import { aProductDiscount, HOME_800, quoteOf } from '../../support/pipeline';

const CHARGED_800: DeliveryBlock = deliveryBlock(HOME_800, false);
const WAIVED_800: DeliveryBlock = deliveryBlock(HOME_800, true);

describe('totalsOf', () => {
  it('sums subtotal from line totals', () => {
    // Arrange
    const lines = [
      { originalPrice: 4_900, quantity: 2, totalPrice: 8_820 },
      { originalPrice: 1_000, quantity: 1, totalPrice: 1_000 },
    ];

    // Act
    const totals = totalsOf({ lines, discounts: [{ amount: 500 }], delivery: CHARGED_800 });

    // Assert
    expect(totals).toEqual({ subtotal: 9_820, discountTotal: 500, total: 10_120, savings: 980 + 500 });
  });

  it('keeps line discounts out of discountTotal', () => {
    // Act
    const quote = quoteOf({ offers: [aProductDiscount()] });

    // Assert
    expect(quote.discountTotal).toBe(0);
    expect(quote.subtotal).toBe(4_410);
    expect(quote.savings).toBe(490);
  });

  it('computes savings with the waived fee', () => {
    // Arrange
    const lines = [{ originalPrice: 4_900, quantity: 3, totalPrice: 12_495 }];

    // Act
    const totals = totalsOf({ lines, discounts: [], delivery: WAIVED_800 });

    // Assert
    expect(totals).toEqual({ subtotal: 12_495, discountTotal: 0, total: 12_495, savings: 2_205 + 800 });
  });

  it('refuses a total above the int column max', () => {
    // Arrange
    const lines = [{ originalPrice: MONEY_MAX_DZD, quantity: 1, totalPrice: MONEY_MAX_DZD }];

    // Act
    const act = () => totalsOf({ lines, discounts: [], delivery: CHARGED_800 });
    const actThroughEngine = () => quoteOf({}, { lines: [aLine({ originalPrice: MONEY_MAX_DZD - 1, quantity: 2 })] });

    // Assert
    expect(act).toThrow(PricingTotalTooLargeError);
    expect(actThroughEngine).toThrow(PricingTotalTooLargeError);
  });
});
