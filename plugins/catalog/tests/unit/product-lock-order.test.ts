import { describe, expect, it } from 'vitest';
import { toCoreId } from '../../domain/core-id';
import { inLockOrder, packSaveLockSteps } from '../../domain/product-lock-order';

describe('product lock order', () => {
  it('orders ids by numeric value, not as text', () => {
    // Act
    const ordered = inLockOrder(['10', '9', '100'].map(toCoreId));

    // Assert
    expect(ordered).toEqual(['9', '10', '100']);
  });

  it('locks the pack product exclusively and each component shared, all in id order (D2242)', () => {
    // Act
    const steps = packSaveLockSteps(toCoreId('15'), ['30', '9', '20']);

    // Assert
    expect(steps).toEqual([
      { productId: '9', mode: 'shared' },
      { productId: '15', mode: 'exclusive' },
      { productId: '20', mode: 'shared' },
      { productId: '30', mode: 'shared' },
    ]);
  });

  it('locks a repeated component once, skips a malformed id and never locks the pack product shared', () => {
    // Act
    const steps = packSaveLockSteps(toCoreId('15'), ['9', '9', 'abc', '15', '0']);

    // Assert
    expect(steps).toEqual([
      { productId: '9', mode: 'shared' },
      { productId: '15', mode: 'exclusive' },
    ]);
  });
});
