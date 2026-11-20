import { MAX_LINE_OFFERS_APPLIED, MAX_ORDER_DISCOUNTS_APPLIED, type CombinationClass } from '@cod/shared';
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

/** A candidate of offer `id` in `combinationClass`, worth `value`, on `lineKeys`, combining with nothing. */
const aCandidate = (
  id: string,
  combinationClass: CombinationClass,
  value: number,
  lineKeys: readonly string[] = [],
) => ({
  offer: anOffer({ id }),
  combinationClass,
  value,
  lineKeys,
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

  it('accepts at most MAX_LINE_OFFERS_APPLIED product candidates on one line, the most valuable, and rejects the rest', () => {
    // Arrange
    const count = MAX_LINE_OFFERS_APPLIED + 2;
    const candidates = Array.from({ length: count }, (_, index) => ({
      ...aCandidate(String(index + 1), 'product', 100 + index, ['11']),
      offer: anOffer({ id: String(index + 1), combinesWith: ALL }),
    }));

    // Act
    const { accepted, rejected } = combine(candidates);

    // Assert
    expect(accepted).toHaveLength(MAX_LINE_OFFERS_APPLIED);
    expect(accepted.map(({ offer }) => offer.id)).toEqual(['6', '5', '4', '3']);
    expect(rejected.map(({ offer }) => offer.id)).toEqual(['2', '1']);
  });

  it('bounds product candidates per line, so more than MAX_LINE_OFFERS_APPLIED on distinct lines all apply', () => {
    // Arrange
    const count = MAX_LINE_OFFERS_APPLIED + 2;
    const distinct = Array.from({ length: count }, (_, index) => ({
      ...aCandidate(String(index + 1), 'product', 100 + index, [String(index + 1)]),
      offer: anOffer({ id: String(index + 1), combinesWith: ALL }),
    }));
    const onLineOne = Array.from({ length: MAX_LINE_OFFERS_APPLIED }, (_, index) => ({
      ...aCandidate(String(index + 50), 'product', 10 + index, ['1', '2']),
      offer: anOffer({ id: String(index + 50), combinesWith: ALL }),
    }));

    // Act
    const { accepted, rejected } = combine([...distinct, ...onLineOne]);

    // Assert
    expect(accepted.map(({ offer }) => offer.id)).toEqual(['6', '5', '4', '3', '2', '1', '53', '52', '51']);
    expect(rejected.map(({ offer }) => offer.id)).toEqual(['50']);
  });

  it('applies combinable product discounts on more distinct products than MAX_LINE_OFFERS_APPLIED', () => {
    // Arrange
    const count = MAX_LINE_OFFERS_APPLIED + 1;
    const offers = Array.from({ length: count }, (_, index) =>
      aProductDiscount({
        id: String(7100 + index),
        combinesWith: ALL,
        targets: [{ role: 'buy', refType: 'product', refId: String(index + 1) }],
      }),
    );
    const lines = Array.from({ length: count }, (_, index) =>
      aLine({ productId: String(index + 1), variantId: String(index + 11) }),
    );

    // Act
    const quote = quoteOf({ offers }, { lines });

    // Assert
    expect(quote.skipped).toEqual([]);
    expect(quote.applied).toHaveLength(count);
    expect(quote.lines.every(({ unitPrice, discounts }) => unitPrice === 4_410 && discounts.length === 1)).toBe(true);
  });

  it('accepts at most MAX_ORDER_DISCOUNTS_APPLIED order candidates and still accepts other classes', () => {
    // Arrange
    const orders = Array.from({ length: MAX_ORDER_DISCOUNTS_APPLIED + 1 }, (_, index) => ({
      ...aCandidate(String(index + 1), 'order', 500),
      offer: anOffer({ id: String(index + 1), combinesWith: ALL }),
    }));
    const delivery = { ...aCandidate('99', 'delivery', 10), offer: anOffer({ id: '99', combinesWith: ALL }) };

    // Act
    const { accepted, rejected } = combine([...orders, delivery]);

    // Assert
    expect(accepted.filter(({ combinationClass }) => combinationClass === 'order')).toHaveLength(
      MAX_ORDER_DISCOUNTS_APPLIED,
    );
    expect(accepted.map(({ offer }) => offer.id)).toContain('99');
    expect(rejected.map(({ offer }) => offer.id)).toEqual([String(MAX_ORDER_DISCOUNTS_APPLIED + 1)]);
  });
});
