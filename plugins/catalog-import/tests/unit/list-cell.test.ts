import { describe, expect, it } from 'vitest';
import { joinListCell, parseProductKey, productKeyCell, splitListCell } from '../../domain/list-cell';

describe('list cells and product keys round-trip (Task 8 review, D2261)', () => {
  it('an item holding ; round-trips through the export writer and the reader', () => {
    // Arrange
    const tags = ['Summer; 2026', 'plain', 'back\\slash'];

    // Act
    const cell = joinListCell(tags);

    // Assert
    expect(cell).toBe('Summer\\; 2026;plain;back\\\\slash');
    expect(splitListCell(cell ?? '')).toEqual(tags);
  });

  it('an image link holding ; round-trips', () => {
    // Arrange
    const urls = ['https://img.example/a;v=2.jpg', 'https://img.example/b.jpg'];

    // Act and Assert
    expect(splitListCell(joinListCell(urls) ?? '')).toEqual(urls);
  });

  it('a hand-made cell splits on ; and trims, a lone backslash kept', () => {
    // Act and Assert
    expect(splitListCell(' red ; blue;;C:\\x ')).toEqual(['red', 'blue', 'C:\\x']);
  });

  it('an empty list is an empty cell', () => {
    // Act and Assert
    expect(joinListCell([])).toBeNull();
  });

  it('a SKU starting id: round-trips as a SKU, not a product id', () => {
    // Act
    const cell = productKeyCell('id:42');

    // Assert
    expect(cell).toBe('\\id:42');
    expect(parseProductKey(cell)).toEqual({ kind: 'sku', sku: 'id:42' });
    expect(parseProductKey(productKeyCell('\\odd'))).toEqual({ kind: 'sku', sku: '\\odd' });
    expect(productKeyCell('TSHIRT-1')).toBe('TSHIRT-1');
  });

  it('an id:<n> key names a product id, any case', () => {
    // Act and Assert
    expect(parseProductKey('id:42')).toEqual({ kind: 'id', productId: '42' });
    expect(parseProductKey(' ID:7 ')).toEqual({ kind: 'id', productId: '7' });
    expect(parseProductKey('TSHIRT-1')).toEqual({ kind: 'sku', sku: 'TSHIRT-1' });
  });
});
