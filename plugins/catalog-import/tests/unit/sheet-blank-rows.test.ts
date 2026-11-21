import { describe, expect, it } from 'vitest';
import type { ReadLimits } from '../../application/ports/spreadsheet-format.port';
import { CsvSpreadsheetReader } from '../../infrastructure/csv-reader';
import { XlsxSpreadsheetReader } from '../../infrastructure/xlsx-reader';
import { sheetXml, xlsxOf } from '../support/real-zip';
import { bytesOf } from '../support/scope';

const CAP = 5;
const BLANK_ROWS = 40;
const limits = (): ReadLimits => ({ maxRows: CAP, deadlineAt: Date.now() + 60_000, now: Date.now });
const TABLE = [
  ['name', 'price'],
  ['Shirt', '1500'],
  ['Mug', '700'],
];

describe('blank rows do not count against the row cap (D2271)', () => {
  it('a CSV with trailing empty lines of separators past the cap is read whole', async () => {
    // Arrange: Excel saves formatted empty rows as lines of separators only
    const text = [...TABLE.map((cells) => cells.join(',')), ...Array.from({ length: BLANK_ROWS }, () => ', ')].join(
      '\r\n',
    );

    // Act
    const sheet = await new CsvSpreadsheetReader().read(bytesOf(text), limits());

    // Assert
    expect(sheet.truncated).toBe(false);
    expect(sheet.rows.map((row) => row.number)).toEqual([1, 2, 3]);
  });

  it('an xlsx with style-only rows past the cap is read whole', async () => {
    // Arrange: rows formatted (a fill, a border) far below the table, with no values
    const styled = Array.from({ length: BLANK_ROWS }, (_, index) => {
      const row = String(index + 4);
      return `<row r="${row}" s="1" customFormat="1"><c r="A${row}" s="1"/><c r="B${row}" s="1"/></row>`;
    }).join('');
    const sheet = sheetXml(TABLE).replace('</sheetData>', `${styled}</sheetData>`);

    // Act
    const read = await new XlsxSpreadsheetReader().read(xlsxOf(sheet), limits());

    // Assert
    expect(read.truncated).toBe(false);
    expect(read.rows.map((row) => row.number)).toEqual([1, 2, 3]);
  });

  it('data rows past the cap still cut the file', async () => {
    // Arrange
    const text = [...TABLE, ...TABLE, ...TABLE].map((cells) => cells.join(',')).join('\r\n');

    // Act
    const sheet = await new CsvSpreadsheetReader().read(bytesOf(text), limits());

    // Assert
    expect(sheet.truncated).toBe(true);
    expect(sheet.rows).toHaveLength(CAP);
  });
});
