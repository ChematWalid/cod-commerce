import { describe, expect, it } from 'vitest';
import { startReorderDrag } from '../../dashboard/model/reorder-drag';

/** A drag's data store, as the browser hands it to `dragstart`. */
function fakeTransfer() {
  const data = new Map<string, string>();
  return {
    data,
    effectAllowed: 'uninitialized',
    setData: (format: string, value: string): void => {
      data.set(format, value);
    },
  };
}

describe('reorder drag', () => {
  it('puts the dragged position in the drag data, which Firefox needs to start a drag at all', () => {
    // Arrange
    const transfer = fakeTransfer();

    // Act
    startReorderDrag(transfer, 2);

    // Assert
    expect(transfer.data.get('text/plain')).toBe('2');
  });

  it('offers a move, not a copy', () => {
    // Arrange
    const transfer = fakeTransfer();

    // Act
    startReorderDrag(transfer, 0);

    // Assert
    expect(transfer.effectAllowed).toBe('move');
  });
});
