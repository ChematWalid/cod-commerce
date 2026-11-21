import { describe, expect, it } from 'vitest';
import { rowKeysFor, withoutRowKey } from '../../dashboard/model/row-keys';

/** Mints `k1`, `k2`, ... so the keys a test expects are known. */
function counterMint(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `k${next.toString()}`;
  };
}

describe('row keys', () => {
  it('removing the first of two rows keeps the second row on its own key', () => {
    // Arrange
    const keys = rowKeysFor([], 2, counterMint());

    // Act
    const after = rowKeysFor(withoutRowKey(keys, 0), 1, counterMint());

    // Assert
    expect(keys).toEqual(['k1', 'k2']);
    expect(after).toEqual(['k2']);
  });

  it('an added row gets a fresh key and the others keep theirs', () => {
    // Arrange
    const mint = counterMint();
    const keys = rowKeysFor([], 1, mint);

    // Act
    const after = rowKeysFor(keys, 2, mint);

    // Assert
    expect(after).toEqual(['k1', 'k2']);
  });

  it('answers the same list while the row count is unchanged', () => {
    // Arrange
    const keys = rowKeysFor([], 3, counterMint());

    // Act
    const after = rowKeysFor(keys, 3, counterMint());

    // Assert
    expect(after).toBe(keys);
  });

  it('drops the keys of rows that no longer exist when the rule is replaced by a shorter one', () => {
    // Arrange
    const keys = rowKeysFor([], 3, counterMint());

    // Act
    const after = rowKeysFor(keys, 1, counterMint());

    // Assert
    expect(after).toEqual(['k1']);
  });
});
