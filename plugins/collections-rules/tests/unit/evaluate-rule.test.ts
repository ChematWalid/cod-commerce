import { describe, expect, it } from 'vitest';
import { matchesRule, matchingIds } from '../../domain/evaluate-rule';
import {
  ACME_BRAND,
  brandIs,
  facts,
  onSaleIs,
  OTHER_BRAND,
  optionIs,
  priceBetween,
  PROMO_TAG,
  ruleOf,
  SUMMER_TAG,
  tagIs,
  titleIs,
  UNKNOWN_TAG,
} from './rule-fixtures';

/** AC1: the four corners of "tag promo" × "price between 1 000 and 5 000". */
const PROMO_CHEAP = facts({ productId: '4', tagIds: [PROMO_TAG], price: 2_000 });
const PROMO_DEAR = facts({ productId: '3', tagIds: [PROMO_TAG], price: 9_000 });
const PLAIN_CHEAP = facts({ productId: '2', price: 3_000 });
const PLAIN_DEAR = facts({ productId: '1', price: 8_000 });
const FOUR_PRODUCTS = [PROMO_CHEAP, PROMO_DEAR, PLAIN_CHEAP, PLAIN_DEAR];

const red = (hidden: boolean, price = 2_000, oldPrice: number | null = null) => ({
  hidden,
  price,
  oldPrice,
  options: [{ name: 'Color', value: 'Red' }],
});
const blue = (hidden: boolean, price = 2_000, oldPrice: number | null = null) => ({
  hidden,
  price,
  oldPrice,
  options: [{ name: 'Color', value: 'Blue' }],
});

describe('matchesRule', () => {
  it('keeps the intersection for All and the union for Any (AC1)', () => {
    // Arrange
    const conditions = [tagIs('is_any_of', PROMO_TAG), priceBetween(1_000, 5_000)] as const;

    // Act
    const all = matchingIds(ruleOf('all', ...conditions), FOUR_PRODUCTS);
    const any = matchingIds(ruleOf('any', ...conditions), FOUR_PRODUCTS);

    // Assert
    expect(all).toEqual(['4']);
    expect(any).toEqual(['4', '3', '2']);
  });

  it('matches an untagged product with "tag is not"', () => {
    // Arrange
    const rule = ruleOf('all', tagIs('is_not', PROMO_TAG));

    // Act
    const matched = matchesRule(rule, facts({ productId: '1' }));

    // Assert
    expect(matched).toBe(true);
  });

  it('holds "is not [a, b]" only for a product with neither', () => {
    // Arrange
    const rule = ruleOf('all', tagIs('is_not', PROMO_TAG, SUMMER_TAG));
    const products = [
      facts({ productId: '3', tagIds: [PROMO_TAG] }),
      facts({ productId: '2', tagIds: [SUMMER_TAG] }),
      facts({ productId: '1', tagIds: [UNKNOWN_TAG] }),
    ];

    // Act
    const matched = matchingIds(rule, products);

    // Assert
    expect(matched).toEqual(['1']);
  });

  it('matches a product without brand with "brand is not"', () => {
    // Arrange
    const rule = ruleOf('all', brandIs('is_not', ACME_BRAND));

    // Act
    const matched = matchingIds(rule, [facts({ productId: '2' }), facts({ productId: '1', brandId: ACME_BRAND })]);

    // Assert
    expect(matched).toEqual(['2']);
  });

  it('never matches a product without brand with "brand is any of"', () => {
    // Arrange
    const rule = ruleOf('all', brandIs('is_any_of', ACME_BRAND, OTHER_BRAND));

    // Act
    const matched = matchingIds(rule, [facts({ productId: '2' }), facts({ productId: '1', brandId: OTHER_BRAND })]);

    // Assert
    expect(matched).toEqual(['1']);
  });

  it('includes both bounds of a price range', () => {
    // Arrange
    const rule = ruleOf('all', priceBetween(1_000, 5_000));
    const products = [999, 1_000, 5_000, 5_001].map((price, index) => facts({ productId: String(index + 1), price }));

    // Act
    const matched = matchingIds(rule, products);

    // Assert
    expect(matched).toEqual(['2', '3']);
  });

  it('reads a price range with only a minimum or only a maximum', () => {
    // Arrange
    const products = [500, 5_000].map((price, index) => facts({ productId: String(index + 1), price }));

    // Act
    const fromMin = matchingIds(ruleOf('all', priceBetween(1_000, null)), products);
    const upToMax = matchingIds(ruleOf('all', priceBetween(null, 1_000)), products);

    // Assert
    expect(fromMin).toEqual(['2']);
    expect(upToMax).toEqual(['1']);
  });

  it('prices a product at its lowest visible variant: 800 and 3 000 fail between 1 000 and 5 000 (D2304)', () => {
    // Arrange
    const rule = ruleOf('all', priceBetween(1_000, 5_000));
    const product = facts({ productId: '1', variants: [red(false, 800), blue(false, 3_000)] });

    // Act
    const matched = matchesRule(rule, product);

    // Assert
    expect(matched).toBe(false);
  });

  it('needs a visible variant whose old price is above its price for "on sale is true"', () => {
    // Arrange
    const rule = ruleOf('all', onSaleIs(true));
    const onSale = facts({ productId: '2', variants: [red(false, 2_000, 2_500)] });
    const notOnSale = facts({ productId: '1', variants: [red(false, 2_000, null)] });

    // Act
    const matched = matchingIds(rule, [onSale, notOnSale]);

    // Assert
    expect(matched).toEqual(['2']);
  });

  it('holds "on sale is false" when the old price equals the price', () => {
    // Arrange
    const rule = ruleOf('all', onSaleIs(false));

    // Act
    const matched = matchesRule(rule, facts({ productId: '1', variants: [red(false, 2_000, 2_000)] }));

    // Assert
    expect(matched).toBe(true);
  });

  it('matches "Color is any of [Red]" on a visible Red variant, case and harakat ignored', () => {
    // Arrange
    const rule = ruleOf('all', optionIs('color', 'is_any_of', 'RED'));
    const arabicRule = ruleOf('all', optionIs('اللون', 'is_any_of', 'احمر'));
    const arabic = facts({
      productId: '2',
      variants: [{ hidden: false, price: 1_000, oldPrice: null, options: [{ name: 'اللَّون', value: 'أحمَر' }] }],
    });

    // Act
    const matched = matchesRule(rule, facts({ productId: '1', variants: [blue(false), red(false)] }));
    const arabicMatched = matchesRule(arabicRule, arabic);

    // Assert
    expect(matched).toBe(true);
    expect(arabicMatched).toBe(true);
  });

  it('ignores hidden variants for option, price and on-sale conditions', () => {
    // Arrange: the only Red variant is hidden, cheap and on sale; the visible one is Blue at 3 000
    const product = facts({ productId: '1', price: 3_000, variants: [red(true, 500, 900), blue(false, 3_000)] });
    const noColor = facts({ productId: '2' });

    // Act
    const redAnyOf = matchesRule(ruleOf('all', optionIs('Color', 'is_any_of', 'Red')), product);
    const redIsNot = matchesRule(ruleOf('all', optionIs('Color', 'is_not', 'Red')), product);
    const noColorIsNot = matchesRule(ruleOf('all', optionIs('Color', 'is_not', 'Red')), noColor);
    const cheap = matchesRule(ruleOf('all', priceBetween(null, 1_000)), product);
    const onSale = matchesRule(ruleOf('all', onSaleIs(true)), product);

    // Assert
    expect(redAnyOf).toBe(false);
    expect(redIsNot).toBe(true);
    expect(noColorIsNot).toBe(true);
    expect(cheap).toBe(false);
    expect(onSale).toBe(false);
  });

  it('prices a product whose variants are all hidden at its own price', () => {
    // Arrange
    const product = facts({ productId: '1', price: 4_000, variants: [red(true, 500)] });

    // Act
    const matched = matchesRule(ruleOf('all', priceBetween(3_000, 5_000)), product);

    // Assert
    expect(matched).toBe(true);
  });

  it('holds "title contains" for any of the values and "not contains" for none', () => {
    // Arrange
    const products = [
      facts({ productId: '3', title: 'Running shoe' }),
      facts({ productId: '2', title: 'Leather bag' }),
      facts({ productId: '1', title: 'Wool scarf' }),
    ];

    // Act
    const contains = matchingIds(ruleOf('all', titleIs('contains', 'SHOE', 'bag')), products);
    const notContains = matchingIds(ruleOf('all', titleIs('not_contains', 'SHOE', 'bag')), products);

    // Assert
    expect(contains).toEqual(['3', '2']);
    expect(notContains).toEqual(['1']);
  });

  it('matches an Arabic title whatever its harakat or tatweel', () => {
    // Arrange
    const rule = ruleOf('all', titleIs('contains', 'حذاء'));

    // Act
    const matched = matchingIds(rule, [
      facts({ productId: '2', title: 'حِذاءٌ رياضي' }),
      facts({ productId: '1', title: 'حـــذاء' }),
    ]);

    // Assert
    expect(matched).toEqual(['2', '1']);
  });

  it('matches nothing with an unknown tag id', () => {
    // Arrange
    const rule = ruleOf('all', tagIs('is_any_of', UNKNOWN_TAG));

    // Act
    const matched = matchingIds(rule, FOUR_PRODUCTS);

    // Assert
    expect(matched).toEqual([]);
  });

  it('holds "any" when one condition is false and another true', () => {
    // Arrange
    const rule = ruleOf('any', tagIs('is_any_of', SUMMER_TAG), priceBetween(1_000, 5_000));

    // Act
    const matched = matchesRule(rule, PLAIN_CHEAP);

    // Assert
    expect(matched).toBe(true);
  });
});
