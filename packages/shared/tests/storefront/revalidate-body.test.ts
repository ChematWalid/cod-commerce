import { describe, expect, it } from 'vitest';
import { STOREFRONT_REVALIDATE_MAX_TAGS, storefrontRevalidateBodySchema } from '../../src/storefront/revalidate';

const STORE = '7300000000000000001';

describe('storefrontRevalidateBodySchema', () => {
  it('accepts a list of storefront cache tags', () => {
    // Arrange
    const body = { tags: [`store:${STORE}`, 'product:12', 'collection:3'] };

    // Act
    const parsed = storefrontRevalidateBodySchema.safeParse(body);

    // Assert
    expect(parsed.success).toBe(true);
  });

  it.each([
    ['an empty list', { tags: [] }],
    ['an unknown kind', { tags: ['user:1'] }],
    ['a leading zero', { tags: ['product:01'] }],
    ['a path-like tag', { tags: ['product:1/../2'] }],
    ['an extra field', { tags: ['store:1'], storeId: STORE }],
    ['no tags field', {}],
  ])('refuses %s', (_name, body) => {
    // Act
    const parsed = storefrontRevalidateBodySchema.safeParse(body);

    // Assert
    expect(parsed.success).toBe(false);
  });

  it(`refuses more than ${String(STOREFRONT_REVALIDATE_MAX_TAGS)} tags`, () => {
    // Arrange
    const tags = Array.from(
      { length: STOREFRONT_REVALIDATE_MAX_TAGS + 1 },
      (_, index) => `product:${String(index + 1)}`,
    );

    // Act
    const parsed = storefrontRevalidateBodySchema.safeParse({ tags });

    // Assert
    expect(parsed.success).toBe(false);
  });
});
