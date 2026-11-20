import { describe, expect, it } from 'vitest';
import { CsvSpreadsheetWriter } from '../../infrastructure/csv-writer';

const BOM = [0xef, 0xbb, 0xbf];
const text = (bytes: Uint8Array): string => new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);

describe('the CSV export writer (D2209)', () => {
  it('export CSV starts with a UTF-8 BOM', async () => {
    // Arrange
    const writer = new CsvSpreadsheetWriter();

    // Act
    const bytes = await writer.write(['name', 'price'], [['Robe', 4500]]);

    // Assert
    expect([...bytes.subarray(0, BOM.length)]).toEqual(BOM);
  });

  it('writes the header, then one line per row, numbers as numbers and null as an empty cell', async () => {
    // Arrange
    const writer = new CsvSpreadsheetWriter();

    // Act
    const bytes = await writer.write(['name', 'price', 'old_price'], [['Robe, kabyle', 4500, null]]);

    // Assert
    expect(text(bytes.subarray(BOM.length))).toBe('name,price,old_price\r\n"Robe, kabyle",4500,\r\n');
  });

  it('guards formula text and keeps Arabic text as written', async () => {
    // Arrange
    const writer = new CsvSpreadsheetWriter();

    // Act
    const bytes = await writer.write(
      ['name', 'price'],
      [
        ['=HYPERLINK("x")', -3],
        ['فستان', 10],
      ],
    );

    // Assert
    expect(text(bytes.subarray(BOM.length))).toBe('name,price\r\n"\'=HYPERLINK(""x"")",-3\r\nفستان,10\r\n');
  });
});
