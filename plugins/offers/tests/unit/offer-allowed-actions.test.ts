import { describe, expect, it } from 'vitest';
import { allowedMovesOf, isDeletableStatus, isEditableStatus } from '../../domain/offer-lifecycle';

const STATUSES = ['draft', 'active', 'paused', 'archived'] as const;

describe('the actions an offer allows (D2510, D2521, D2543)', () => {
  it('lists the moves each status starts', () => {
    // Arrange, Act
    const moves = STATUSES.map((status) => allowedMovesOf(status));

    // Assert
    expect(moves).toEqual([['publish', 'archive'], ['pause', 'archive'], ['resume', 'archive'], []]);
  });

  it('deletes a draft only', () => {
    // Arrange, Act
    const deletable = STATUSES.map((status) => isDeletableStatus(status));

    // Assert
    expect(deletable).toEqual([true, false, false, false]);
  });

  it('edits every offer but an archived one', () => {
    // Arrange, Act
    const editable = STATUSES.map((status) => isEditableStatus(status));

    // Assert
    expect(editable).toEqual([true, true, true, false]);
  });
});
