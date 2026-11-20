import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { DELETE_COLLECTIONS_KEY } from '../../dashboard/constants';
import { errorMessageIdOf, orderedCollections, rowActionsOf } from '../../dashboard/model/list-view';
import { StoreSwitchedError } from '../../dashboard/model/store-bound-fetch';

const row = (id: string, position: number) => ({ id, position });

describe('collection list view', () => {
  it('orders by position then id', () => {
    // Arrange
    const rows = [row('10', 2), row('9', 2), row('100', 0), row('3', 1)];

    // Act
    const ordered = orderedCollections(rows);

    // Assert
    expect(ordered.map(({ id }) => id)).toEqual(['100', '3', '9', '10']);
  });

  it('offers Delete only with the delete key', () => {
    // Act
    const viewer = rowActionsOf(new Set());
    const deleter = rowActionsOf(new Set([DELETE_COLLECTIONS_KEY]));

    // Assert
    expect(viewer).toEqual(['edit']);
    expect(deleter).toEqual(['edit', 'delete']);
  });

  it('shows a collections code as its own message, forbidden and a switch as theirs, anything else as generic', () => {
    // Act
    const ids = [
      errorMessageIdOf({ extensions: { code: COLLECTIONS_ERROR_CODES.SLUG_TAKEN } }),
      errorMessageIdOf({ extensions: { code: 'FORBIDDEN' } }),
      errorMessageIdOf(new StoreSwitchedError()),
      errorMessageIdOf({ extensions: { code: 'INTERNAL_SERVER_ERROR' } }),
    ];

    // Assert
    expect(ids).toEqual([
      COLLECTIONS_ERROR_CODES.SLUG_TAKEN,
      'collections.error-forbidden',
      'collections.error-store-switched',
      'collections.error-generic',
    ]);
  });
});
