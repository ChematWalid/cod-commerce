import { COLLECTION_MAX_MANUAL_PRODUCTS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  type ManualProduct,
  moveBy,
  moveTo,
  productIdsOf,
  reorderKeyDelta,
  withoutProduct,
  withProducts,
} from '../../dashboard/model/manual-order';

const product = (productId: string): ManualProduct => ({
  productId,
  title: `T ${productId}`,
  status: 'active',
  price: 1,
});
const list = (...ids: string[]): readonly ManualProduct[] => ids.map(product);

describe('manual order', () => {
  it('moves a row up/down by keyboard', () => {
    // Arrange
    const rows = list('1', '2', '3');

    // Act
    const up = moveBy(rows, 1, reorderKeyDelta('ArrowUp') ?? 0);
    const down = moveBy(rows, 1, reorderKeyDelta('ArrowDown') ?? 0);
    const pastTop = moveBy(rows, 0, -1);
    const pastEnd = moveBy(rows, 2, 1);

    // Assert
    expect(productIdsOf(up)).toEqual(['2', '1', '3']);
    expect(productIdsOf(down)).toEqual(['1', '3', '2']);
    expect(pastTop).toBe(rows);
    expect(pastEnd).toBe(rows);
    expect(reorderKeyDelta('Enter')).toBeUndefined();
  });

  it('moves a dragged row to where it is dropped', () => {
    // Act
    const moved = moveTo(list('1', '2', '3', '4'), 0, 2);

    // Assert
    expect(productIdsOf(moved)).toEqual(['2', '3', '1', '4']);
  });

  it('removing keeps the others’ order', () => {
    // Act
    const rows = withoutProduct(list('1', '2', '3', '4'), '2');

    // Assert
    expect(productIdsOf(rows)).toEqual(['1', '3', '4']);
  });

  it('adds new products at the end, never one twice, up to the cap', () => {
    // Arrange
    const full = list(...Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS - 1 }, (_, index) => String(index + 1)));

    // Act
    const added = withProducts(list('1', '2'), list('2', '3'));
    const capped = withProducts(full, list('9001', '9002'));

    // Assert
    expect(productIdsOf(added)).toEqual(['1', '2', '3']);
    expect(capped).toHaveLength(COLLECTION_MAX_MANUAL_PRODUCTS);
    expect(capped.at(-1)?.productId).toBe('9001');
  });
});
