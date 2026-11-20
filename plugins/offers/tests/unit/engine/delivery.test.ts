import { describe, expect, it } from 'vitest';
import { deliveryBlock } from '../../../domain/engine/delivery';
import type { ShippingQuoteResult } from '../../../domain/snapshot';
import { UNRESOLVED_SHIPPING } from '../../support/builders';
import { aFreeDelivery, quoteOf } from '../../support/pipeline';

/** Home delivery at 800 DZD plus a 200 DZD overweight fee. */
const HOME_800_PLUS_200: ShippingQuoteResult = { resolved: true, baseFee: 800, overweightFee: 200, speed: '24h' };

describe('deliveryBlock', () => {
  it('waives base and overweight under free delivery with price 0', () => {
    // Act
    const block = deliveryBlock(HOME_800_PLUS_200, true);
    const quote = quoteOf({ offers: [aFreeDelivery()], shipping: HOME_800_PLUS_200 });

    // Assert
    expect(block).toEqual({
      resolved: true,
      fee: 800,
      overweightFee: 200,
      waived: true,
      price: 0,
      freeShipping: true,
      speed: '24h',
    });
    expect(quote.applied).toEqual([{ offerId: '7004', kind: 'free_delivery', amount: 1_000 }]);
    expect(quote.savings).toBe(1_000);
  });

  it('charges base plus overweight without free delivery', () => {
    // Act
    const block = deliveryBlock(HOME_800_PLUS_200, false);

    // Assert
    expect(block).toMatchObject({ waived: false, freeShipping: false, price: 1_000 });
  });

  it('reports unresolved delivery with price 0', () => {
    // Act
    const block = deliveryBlock(UNRESOLVED_SHIPPING, false);

    // Assert
    expect(block).toEqual({
      resolved: false,
      fee: 0,
      overweightFee: 0,
      waived: false,
      price: 0,
      freeShipping: false,
      speed: null,
    });
  });
});
