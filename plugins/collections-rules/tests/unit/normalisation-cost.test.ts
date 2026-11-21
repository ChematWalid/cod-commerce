import { normalForMatch } from '@cod/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchingIds } from '../../domain/evaluate-rule';
import { facts, optionIs, ruleOf, titleIs } from './rule-fixtures';

vi.mock('@cod/shared', async (importOriginal) => {
  const shared = await importOriginal<typeof import('@cod/shared')>();
  return { ...shared, normalForMatch: vi.fn(shared.normalForMatch) };
});

const PRODUCT_COUNT = 200;

/** Products with a title and one `Color` option, so each title and option condition reads them. */
const products = Array.from({ length: PRODUCT_COUNT }, (_, index) =>
  facts({
    productId: String(index + 1),
    title: `Robe d'été ${String(index)}`,
    variants: [{ hidden: false, price: 2_000, oldPrice: null, options: [{ name: 'Color', value: 'Red' }] }],
  }),
);

describe('rule evaluation cost', () => {
  beforeEach(() => {
    vi.mocked(normalForMatch).mockClear();
  });

  it('normalises the rule once and each product text once, not once per product and condition', () => {
    // Arrange: two title and two option conditions of three values each, none of which holds, so all are read
    const rule = ruleOf(
      'any',
      titleIs('contains', 'pantalon', 'chemise', 'veste'),
      titleIs('contains', 'jupe', 'manteau', 'gilet'),
      optionIs('Color', 'is_any_of', 'Blue', 'Green', 'Black'),
      optionIs('Colour', 'is_any_of', 'Blue', 'Green', 'Black'),
    );
    const ruleTexts = 3 + 3 + (1 + 3) * 2;
    const productTexts = PRODUCT_COUNT * (1 + 2);

    // Act
    const matched = matchingIds(rule, products);

    // Assert
    expect(matched).toEqual([]);
    expect(vi.mocked(normalForMatch).mock.calls.length).toBeLessThanOrEqual(ruleTexts + productTexts);
  });
});
