import { describe, expect, it } from 'vitest';
import { chunksOf } from '../../domain/seed-chunks';

describe('chunksOf', () => {
  it('splits rows into chunks of the size, the last one shorter', () => {
    // Act
    const chunks = chunksOf([1, 2, 3, 4, 5], 2);

    // Assert
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('gives no chunk for no rows', () => {
    // Act
    const chunks = chunksOf([], 3);

    // Assert
    expect(chunks).toEqual([]);
  });

  it('refuses a size that is not a positive integer', () => {
    // Act
    const split = (size: number) => () => chunksOf([1], size);

    // Assert
    expect(split(0)).toThrow(RangeError);
    expect(split(1.5)).toThrow(RangeError);
  });
});
