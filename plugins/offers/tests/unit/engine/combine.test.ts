import type { CombinationClass } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { combine } from '../../../domain/engine/combine';
import { aLine, anOffer } from '../../support/builders';
import {
  aFreeDelivery,
  anOrderDiscount,
  aProductDiscount,
  aQuantityOffer,
  HOME_800,
  quoteOf,
} from '../../support/pipeline';

const ALL = { order: true, product: true, delivery: true };

/** A candidate of offer `id` in `combinationClass`, worth `value`, combining with nothing. */
const aCandidate = (id: string, combinationClass: CombinationClass, value: number) => ({
  offer: anOffer({ id }),
  combinationClass,
  value,
});

describe('combine', () => {
  it('keeps only the better of two non-combinable order discounts and skips the other as not_combinable', () => {
    // Arrange
    const tenPercent = anOrderDiscount();
    const fixed500 = anOrderDiscount({ id: '7006', config: { valueType: 'fixed', value: 500 } });

    // Act
    const quote = quoteOf({ offers: [fixed500, tenPercent] }, { lines: [aLine({ quantity: 2 })] });

    // Assert
    expect(quote.discounts).toEqual([{ offerId: '7003', kind: 'order_discount', amount: 980 }]);
    expect(quote.discountTotal).toBe(980);
    expect(quote.skipped).toEqual([{ offerId: '7006', reason: 'not_combinable' }]);
  });

  it('combines free delivery with a product discount when both allow delivery and product', () => {
    // Arrange
    const product = aProductDiscount({ combinesWith: { order: false, product: false, delivery: true } });
    const delivery = aFreeDelivery({ combinesWith: { order: false, product: true, delivery: false } });

    // Act
    const quote = quoteOf({ offers: [product, delivery], shipping: HOME_800 });

    // Assert
    expect(quote.applied.map(({ offerId }) => offerId)).toEqual(['7002', '7004']);
    expect(quote.delivery.price).toBe(0);
    expect(quote.total).toBe(4_410);
  });

  it('refuses a pair when only one side allows the other', () => {
    // Arrange
    const product = aProductDiscount({ combinesWith: { order: false, product: false, delivery: true } });
    const delivery = aFreeDelivery();

    // Act
    const quote = quoteOf({ offers: [product, delivery], shipping: HOME_800 });

    // Assert
    expect(quote.applied).toEqual([{ offerId: '7004', kind: 'free_delivery', amount: 800 }]);
    expect(quote.skipped).toEqual([{ offerId: '7002', reason: 'not_combinable' }]);
  });

  it('breaks a value tie by offer id', () => {
    // Arrange
    const candidates = [aCandidate('10', 'order', 500), aCandidate('9', 'order', 500)];

    // Act
    const { accepted, rejected } = combine(candidates);

    // Assert
    expect(accepted.map(({ offer }) => offer.id)).toEqual(['9']);
    expect(rejected.map(({ offer }) => offer.id)).toEqual(['10']);
  });

  it('accepts candidates of value order when every pair allows each other', () => {
    // Arrange
    const candidates = [
      { ...aCandidate('1', 'order', 100), offer: anOffer({ id: '1', combinesWith: ALL }) },
      { ...aCandidate('2', 'product', 300), offer: anOffer({ id: '2', combinesWith: ALL }) },
    ];

    // Act
    const { accepted, rejected } = combine(candidates);

    // Assert
    expect(accepted.map(({ offer }) => offer.id)).toEqual(['2', '1']);
    expect(rejected).toEqual([]);
  });

  it('stacks an allowed product discount on the quantity price', () => {
    // Arrange
    const quantity = aQuantityOffer({ combinesWith: { order: false, product: true, delivery: false } });
    const product = aProductDiscount({ combinesWith: { order: false, product: true, delivery: false } });

    // Act
    const quote = quoteOf({ offers: [product, quantity] }, { lines: [aLine({ quantity: 2 })] });

    // Assert
    expect(quote.lines[0]).toMatchObject({ unitPrice: 3_969, totalPrice: 7_938 });
    expect(quote.lines[0]?.discounts).toEqual([
      { offerId: '7001', kind: 'quantity', amount: 980 },
      { offerId: '7002', kind: 'product_discount', amount: 882 },
    ]);
  });
});
