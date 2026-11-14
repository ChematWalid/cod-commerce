import { describe, expect, it } from 'vitest';
import { placeholderWithinStore } from '../../dashboard/model/store-placeholder';

const PREFIX = ['catalog', 'products'] as const;
const STORE_A = 'store-a';
const STORE_B = 'store-b';
const ROWS_OF_A = ['row of A'];

const queryOf = (storeId: string | null) => ({ queryKey: [...PREFIX, storeId, {}] });

describe('store placeholder', () => {
  it('keeps the previous answer while the same store changes tab, search or page', () => {
    // Arrange
    const placeholder = placeholderWithinStore(PREFIX.length, STORE_A);

    // Act
    const shown = placeholder(ROWS_OF_A, queryOf(STORE_A));

    // Assert
    expect(shown).toBe(ROWS_OF_A);
  });

  it('shows nothing of the previous store after a store switch', () => {
    // Arrange
    const placeholder = placeholderWithinStore(PREFIX.length, STORE_B);

    // Act
    const shown = placeholder(ROWS_OF_A, queryOf(STORE_A));

    // Assert
    expect(shown).toBeUndefined();
  });

  it('shows nothing while the store is unknown', () => {
    // Arrange
    const placeholder = placeholderWithinStore(PREFIX.length, null);

    // Act
    const shown = placeholder(ROWS_OF_A, queryOf(null));

    // Assert
    expect(shown).toBeUndefined();
  });

  it('shows nothing when there was no previous query', () => {
    // Arrange
    const placeholder = placeholderWithinStore(PREFIX.length, STORE_A);

    // Act
    const shown = placeholder<readonly string[]>(undefined, undefined);

    // Assert
    expect(shown).toBeUndefined();
  });
});
