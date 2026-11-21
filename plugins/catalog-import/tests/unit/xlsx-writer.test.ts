import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { inspectZip } from '../../domain/zip-inspect';
import { XlsxSpreadsheetWriter } from '../../infrastructure/xlsx-writer';

/** The first worksheet's cell values, row by row (exceljs rows are 1-based with an empty slot 0). */
async function cellsOf(bytes: Uint8Array): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error('no worksheet');
  const rows: unknown[][] = [];
  sheet.eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  return rows;
}

describe('the xlsx export writer (D2209)', () => {
  it('writes a workbook our own import accepts, header first', async () => {
    // Arrange
    const writer = new XlsxSpreadsheetWriter();

    // Act
    const bytes = await writer.write(['name', 'price'], [['Robe', 4500]]);

    // Assert
    expect(inspectZip(bytes).ok).toBe(true);
    expect(await cellsOf(bytes)).toEqual([
      ['name', 'price'],
      ['Robe', 4500],
    ]);
  });

  it('writes numbers as numbers and formula text as guarded text, never as a formula', async () => {
    // Arrange
    const writer = new XlsxSpreadsheetWriter();

    // Act
    const bytes = await writer.write(['name', 'price', 'old_price'], [['=HYPERLINK("x")', 10, null]]);

    // Assert
    const [, row] = await cellsOf(bytes);
    expect(row).toEqual(['\'=HYPERLINK("x")', 10]);
    expect(typeof row?.[1]).toBe('number');
  });
});
