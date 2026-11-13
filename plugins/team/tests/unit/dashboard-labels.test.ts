import { describe, expect, it } from 'vitest';
import { EMPTY_VALUE } from '../../dashboard/constants';
import { storesTextOf } from '../../dashboard/labels';

const ALL_STORES_TEXT = 'All stores';
const translate = (id: string): string => (id === 'team.store-access-all' ? ALL_STORES_TEXT : id);

describe('storesTextOf', () => {
  it('reads every store for a member on all stores', () => {
    // Arrange
    const access = { kind: 'all' } as const;

    // Act
    const text = storesTextOf(access, 'en', translate);

    // Assert
    expect(text).toBe(ALL_STORES_TEXT);
  });

  it('lists the store names in the display language', () => {
    // Arrange
    const access = { kind: 'stores', names: ['Alger', 'Oran'] } as const;

    // Act
    const english = storesTextOf(access, 'en', translate);
    const arabic = storesTextOf(access, 'ar', translate);

    // Assert
    expect(english).toBe('Alger, Oran');
    expect(arabic).toBe('Alger، Oran');
  });

  it('shows the empty value when every chosen store is outside the caller reach', () => {
    // Arrange
    const access = { kind: 'stores', names: [] } as const;

    // Act
    const text = storesTextOf(access, 'en', translate);

    // Assert
    expect(text).toBe(EMPTY_VALUE);
  });
});
