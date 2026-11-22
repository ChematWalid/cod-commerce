import { describe, expect, it } from 'vitest';
import { storefrontIdSchema } from '../../src/storefront/catalog-dto';

describe('storefrontIdSchema (ADR 0003)', () => {
  it('accepts the largest bigint id and keeps its exact digits', () => {
    // Arrange
    const largest = '9223372036854775807';

    // Act
    const result = storefrontIdSchema.safeParse(largest);

    // Assert
    expect(result.data).toBe(largest);
  });

  it.each([
    ['19 digits past the bigint range', '9223372036854775808'],
    ['a leading zero', '01'],
    ['zero', '0'],
  ])('refuses %s', (_name, value) => {
    expect(storefrontIdSchema.safeParse(value).success).toBe(false);
  });

  it('refuses a number', () => {
    expect(storefrontIdSchema.safeParse(12).success).toBe(false);
  });
});
