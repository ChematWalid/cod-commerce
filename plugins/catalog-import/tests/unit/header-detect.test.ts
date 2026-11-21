import { IMPORT_HEADER_WINDOW_ROWS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { detectHeader } from '../../domain/header-detect';

describe('detectHeader (D2209, D2224)', () => {
  it('finds the header on row 3 after two title rows', () => {
    // Arrange
    const rows = [['Products of my store'], [''], ['Name', 'Price', 'SKU'], ['Shirt', '1500', 'S-1']];

    // Act and Assert
    expect(detectHeader(rows)).toEqual({ kind: 'found', rowIndex: 2 });
  });

  it('no header in 10 rows → no-header', () => {
    // Arrange: the header comes on row 11, past the window
    const titles = Array.from({ length: IMPORT_HEADER_WINDOW_ROWS }, (_, index) => [`Title ${String(index)}`]);
    const rows = [...titles, ['name', 'price']];

    // Act and Assert
    expect(detectHeader(rows)).toEqual({ kind: 'no-header' });
  });

  it('a row naming only one of the two required columns is not the header', () => {
    // Act and Assert
    expect(
      detectHeader([
        ['name', 'description'],
        ['السعر', 'الاسم'],
      ]),
    ).toEqual({ kind: 'found', rowIndex: 1 });
  });
});
