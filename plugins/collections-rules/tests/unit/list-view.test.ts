import { COLLECTION_LIST_PAGE_SIZE, COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { DELETE_COLLECTIONS_KEY } from '../../dashboard/constants';
import {
  errorMessageIdOf,
  isolatedText,
  orderedCollections,
  pageWithin,
  rowActionsOf,
} from '../../dashboard/model/list-view';
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

  it('steps back to the last page when the total shrinks under the page shown', () => {
    // Arrange
    const onePageLeft = COLLECTION_LIST_PAGE_SIZE;

    // Act
    const afterDelete = pageWithin(2, onePageLeft);
    const stillThere = pageWithin(2, onePageLeft + 1);
    const nothingLeft = pageWithin(3, 0);

    // Assert
    expect(afterDelete).toBe(1);
    expect(stillThere).toBe(2);
    expect(nothingLeft).toBe(1);
  });

  it('isolates merchant text put inside a translated sentence', () => {
    // Act
    const name = isolatedText('Summer 2026!');

    // Assert
    expect(name).toBe('\u2068Summer 2026!\u2069');
  });
});
