import { describe, expect, it } from 'vitest';
import type { PricedLine } from '../../../domain/cart';
import type { PricedQuote } from '../../../domain/engine/priced-quote';
import type { Offer } from '../../../domain/offer';
import { aLine } from '../../support/builders';
import { aProductDiscount, anOrderDiscount, aQuantityOffer, HOME_800, quoteOf } from '../../support/pipeline';

/** Carts the property test draws, and the seed that makes every run draw the same ones. */
const RANDOM_CARTS = 500;
const SEED = 0x5eed_2404;
const MAX_LINES = 5;
const MAX_QUANTITY = 12;
const MAX_UNIT_PRICE = 99_999;
const STACKS_EVERYTHING = { order: true, product: true, delivery: true };

/** Mulberry32: a small deterministic generator, so a failing cart is reproducible from {@link SEED}. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A whole number in `[min, max]`. */
const intIn = (random: () => number, min: number, max: number): number => min + Math.floor(random() * (max - min + 1));

function randomLines(random: () => number): PricedLine[] {
  const count = intIn(random, 1, MAX_LINES);
  return Array.from({ length: count }, (_, index) =>
    aLine({
      variantId: String(11 + index),
      productId: String(intIn(random, 1, 2)),
      quantity: intIn(random, 1, MAX_QUANTITY),
      originalPrice: intIn(random, 0, MAX_UNIT_PRICE),
    }),
  );
}

function randomOffers(random: () => number): Offer[] {
  const percent = (): number => intIn(random, 1, 99);
  return [
    aQuantityOffer({
      combinesWith: STACKS_EVERYTHING,
      config: { priceMode: 'percent', tiers: [{ quantity: 2, price: percent() }] },
    }),
    aProductDiscount({
      combinesWith: STACKS_EVERYTHING,
      config: { valueType: random() < 0.5 ? 'percent' : 'fixed', value: percent(), appliesTo: 'targets' },
    }),
    anOrderDiscount({ combinesWith: STACKS_EVERYTHING, config: { valueType: 'percent', value: percent() } }),
  ];
}

/** Every amount of the quote, flattened, to check they are all whole DZD. */
function amountsOf(quote: PricedQuote): number[] {
  const lineAmounts = quote.lines.flatMap((line) => [
    line.unitPrice,
    line.totalPrice,
    ...line.discounts.map((discount) => discount.amount),
  ]);
  const totals = [quote.subtotal, quote.discountTotal, quote.total, quote.savings, quote.delivery.price];
  return [...lineAmounts, ...quote.discounts.map((discount) => discount.amount), ...totals];
}

describe('rounding (D2409)', () => {
  it('rounds 4950 at 15 percent to 4207 per unit', () => {
    // Arrange
    const offer = aProductDiscount({ config: { valueType: 'percent', value: 15, appliesTo: 'targets' } });
    const lines = [aLine({ originalPrice: 4_950, quantity: 2 })];

    // Act
    const quote = quoteOf({ offers: [offer] }, { lines });

    // Assert
    expect(quote.lines[0]).toMatchObject({ unitPrice: 4_207, totalPrice: 8_414 });
    expect(quote.lines[0]?.discounts).toEqual([{ offerId: '7002', kind: 'product_discount', amount: 1_486 }]);
  });

  it('rounds a 15 percent quantity tier of 4950 to 4207 per unit', () => {
    // Arrange
    const offer = aQuantityOffer({ config: { priceMode: 'percent', tiers: [{ quantity: 2, price: 15 }] } });
    const lines = [aLine({ originalPrice: 4_950, quantity: 2 })];

    // Act
    const quote = quoteOf({ offers: [offer] }, { lines });

    // Assert
    expect(quote.lines[0]).toMatchObject({ unitPrice: 4_207, totalPrice: 8_414 });
  });

  it('keeps every amount an integer across 500 random carts', () => {
    // Arrange
    const random = seededRandom(SEED);

    for (let cart = 0; cart < RANDOM_CARTS; cart += 1) {
      // Act
      const quote = quoteOf({ offers: randomOffers(random), shipping: HOME_800 }, { lines: randomLines(random) });

      // Assert
      for (const amount of amountsOf(quote)) {
        expect(Number.isInteger(amount) && amount >= 0, `cart ${String(cart)}: ${String(amount)}`).toBe(true);
      }
      for (const line of quote.lines) expect(line.totalPrice).toBe(line.unitPrice * line.quantity);
      expect(quote.total).toBe(quote.subtotal - quote.discountTotal + quote.delivery.price);
    }
  });
});
