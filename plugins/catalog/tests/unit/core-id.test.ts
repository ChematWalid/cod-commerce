import { describe, expect, it } from 'vitest';
import { parseCoreId, toCoreId } from '../../domain/core-id';
import { InvalidCatalogInputError } from '../../domain/errors';

describe('core id', () => {
  it.each(['1', '42', '2147483647'])('accepts the positive integer %s', (value) => {
    // Act
    const parsed = parseCoreId(value);

    // Assert
    expect(parsed).toBe(value);
    expect(toCoreId(value)).toBe(value);
  });

  it.each(['abc', '0', '-1', '1.5', '007', '', ' 1', '2147483648', '99999999999999999999'])(
    'refuses the malformed id "%s"',
    (value) => {
      // Act
      const parsed = parseCoreId(value);

      // Assert
      expect(parsed).toBeUndefined();
      expect(() => toCoreId(value)).toThrow(InvalidCatalogInputError);
    },
  );
});
