import { IMPORT_HEADER_WINDOW_ROWS, IMPORT_MAX_CELL_CHARS, IMPORT_MAX_ROWS } from '@cod/shared';
import { IMPORT_MAX_SHEET_CHARS } from '../../domain/constants';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { ReadLimits } from '../../application/ports/spreadsheet-format.port';
import { FileTypeError } from '../../domain/errors';
import { CsvSpreadsheetReader } from '../../infrastructure/csv-reader';
import { XlsxSpreadsheetReader } from '../../infrastructure/xlsx-reader';
import { realZipOf, sheetXml, workbookFilesOf, xlsxOf } from '../support/real-zip';
import { bytesOf } from '../support/scope';

const BOM = '\uFEFF';
const READ_CAP = IMPORT_MAX_ROWS + IMPORT_HEADER_WINDOW_ROWS + 1;
const limits = (change: Partial<ReadLimits> = {}): ReadLimits => ({
  maxRows: READ_CAP,
  deadlineAt: Date.now() + 60_000,
  now: Date.now,
  ...change,
});

async function xlsxBytes(build: (workbook: ExcelJS.Workbook) => void): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

const csv = new CsvSpreadsheetReader();
const xlsx = new XlsxSpreadsheetReader();

describe('CsvSpreadsheetReader (D2209, D2222)', () => {
  it('reads a semicolon CSV with BOM and Arabic headers', async () => {
    // Arrange: as Excel saves it on an Arabic or French Windows
    const bytes = bytesOf(`${BOM}الاسم;السعر;الوصف\r\nقميص;1500;"قطن; أزرق"\r\n`);

    // Act
    const sheet = await csv.read(bytes, limits());

    // Assert
    expect(sheet).toEqual({
      truncated: false,
      rows: [
        { number: 1, cells: ['الاسم', 'السعر', 'الوصف'] },
        { number: 2, cells: ['قميص', '1500', 'قطن; أزرق'] },
      ],
    });
  });

  it('single 10 MiB CSV line refused', async () => {
    // Arrange
    const line = `name,price\r\n${'x'.repeat(10 * 1024 * 1024)},1\r\n`;

    // Act and Assert
    await expect(csv.read(bytesOf(line), limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('an unbalanced quote is refused', async () => {
    // Act and Assert
    await expect(csv.read(bytesOf('name,price\r\n"Shirt,1500\r\n'), limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('a cell over 10 000 characters is refused', async () => {
    // Arrange
    const text = `name,description\r\nA,${'d'.repeat(IMPORT_MAX_CELL_CHARS + 1)}\r\n`;

    // Act and Assert
    await expect(csv.read(bytesOf(text), limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('a row of more than 64 columns is refused', async () => {
    // Act and Assert
    await expect(csv.read(bytesOf(`${'a,'.repeat(70)}a\r\n`), limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('stops at the row cap and says the file was cut', async () => {
    // Arrange
    const text = ['name,price', ...Array.from({ length: 20 }, (_, index) => `P${String(index)},1`)].join('\r\n');

    // Act
    const sheet = await csv.read(bytesOf(text), limits({ maxRows: 5 }));

    // Assert
    expect(sheet.truncated).toBe(true);
    expect(sheet.rows).toHaveLength(5);
  });

  it('past the deadline the read stops as file-type', async () => {
    // Act and Assert
    await expect(csv.read(bytesOf('name,price\r\nA,1\r\n'), limits({ deadlineAt: 0 }))).rejects.toBeInstanceOf(
      FileTypeError,
    );
  });

  it('the deadline is read on the clock that set it, not the wall clock', async () => {
    // Arrange: an injected clock already past the deadline; the wall clock is long before it
    const late = limits({ deadlineAt: Date.now() + 60_000, now: () => Date.now() + 120_000 });

    // Act and Assert
    await expect(csv.read(bytesOf('name,price\r\nA,1\r\n'), late)).rejects.toBeInstanceOf(FileTypeError);
  });

  it('bytes that are not UTF-8 are refused', async () => {
    // Act and Assert
    await expect(csv.read(new Uint8Array([0x6e, 0xff, 0xfe, 0x2c]), limits())).rejects.toBeInstanceOf(FileTypeError);
  });
});

describe('XlsxSpreadsheetReader (D2209, D2222)', () => {
  it('uses the cached value of a formula cell', async () => {
    // Arrange: the formula would give 4; the cached result says 1500 and is what Excel showed
    const bytes = await xlsxBytes((workbook) => {
      const sheet = workbook.addWorksheet('products');
      sheet.addRow(['name', 'price']);
      sheet.addRow(['Shirt', { formula: '2+2', result: 1500 }]);
    });

    // Act
    const sheet = await xlsx.read(bytes, limits());

    // Assert
    expect(sheet.rows).toEqual([
      { number: 1, cells: ['name', 'price'] },
      { number: 2, cells: ['Shirt', '1500'] },
    ]);
  });

  it('reads only the first worksheet', async () => {
    // Arrange
    const bytes = await xlsxBytes((workbook) => {
      workbook.addWorksheet('products').addRow(['name', 'price']);
      workbook.addWorksheet('notes').addRow(['secret', 'notes']);
    });

    // Act
    const sheet = await xlsx.read(bytes, limits());

    // Assert
    expect(sheet.rows).toEqual([{ number: 1, cells: ['name', 'price'] }]);
  });

  it('16 384-column row refused', async () => {
    // Arrange
    const bytes = await xlsxBytes((workbook) => {
      const sheet = workbook.addWorksheet('products');
      sheet.addRow(['name', 'price']);
      sheet.getCell(2, 16_384).value = 'far';
    });

    // Act and Assert
    await expect(xlsx.read(bytes, limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('DOCTYPE entity refused', async () => {
    // Arrange
    const sheet = sheetXml(
      [
        ['name', 'price'],
        ['&a;', '1'],
      ],
      '<!DOCTYPE worksheet [<!ENTITY a "aaaaaaaaaa">]>',
    );

    // Act and Assert
    await expect(xlsx.read(xlsxOf(sheet), limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('reads a hand-written workbook of inline strings', async () => {
    // Act
    const sheet = await xlsx.read(
      xlsxOf(
        sheetXml([
          ['name', 'price'],
          ['Shirt', '1500'],
        ]),
      ),
      limits(),
    );

    // Assert
    expect(sheet.rows.map((row) => row.cells)).toEqual([
      ['name', 'price'],
      ['Shirt', '1500'],
    ]);
  });

  it('a zip that is not a workbook is refused', async () => {
    // Act and Assert
    await expect(xlsx.read(bytesOf('PK\u0003\u0004 not really'), limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('stops at IMPORT_MAX_ROWS + header window whatever the declared dimension', async () => {
    // Arrange: the sheet's dimension claims two rows; it holds many more
    const rows = [
      ['name', 'price'],
      ...Array.from({ length: READ_CAP + 20 }, (_, index) => [`P${String(index)}`, '1']),
    ];
    const sheet = sheetXml(rows).replace('<sheetData>', '<dimension ref="A1:B2"/><sheetData>');

    // Act
    const read = await xlsx.read(xlsxOf(sheet), limits());

    // Assert
    expect(read.truncated).toBe(true);
    expect(read.rows).toHaveLength(READ_CAP);
  });
});

/** Text of `length` letters that deflates poorly (a linear congruential sequence), so its part passes the ratio cap. */
function noiseOf(length: number): string {
  let seed = 7;
  return Array.from({ length }, () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return String.fromCharCode(97 + (seed % 26));
  }).join('');
}

/** A workbook whose every cell points at one shared string of `text`: a few bytes per cell in the sheet XML. */
function sharedStringsXlsx(text: string, rows: number, columns: number): Uint8Array {
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const body = Array.from({ length: rows }, (_, row) => {
    const cells = Array.from({ length: columns }, (_, column) => {
      const ref = `${String.fromCharCode(65 + column)}${String(row + 1)}`;
      return `<c r="${ref}" t="s"><v>0</v></c>`;
    });
    return `<row r="${String(row + 1)}">${cells.join('')}</row>`;
  }).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${body}</sheetData></worksheet>`;
  const strings = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${ns}" count="1" uniqueCount="1"><si><t>${text}</t></si></sst>`;
  // The shared strings part comes before the sheet, as Excel writes it, so the streaming reader has it cached.
  const parts = workbookFilesOf(sheet);
  return realZipOf([...parts.slice(0, -1), { name: 'xl/sharedStrings.xml', text: strings }, ...parts.slice(-1)]);
}

describe('the characters a sheet may yield in all (D2269)', () => {
  it('cells pointing at one long shared string past the budget are refused', async () => {
    // Arrange: about 2 000 cells of one 10 000-character string, far past the budget, from a small file
    const columns = 20;
    const rows = Math.ceil(IMPORT_MAX_SHEET_CHARS / IMPORT_MAX_CELL_CHARS / columns) + 1;
    const bytes = sharedStringsXlsx(noiseOf(IMPORT_MAX_CELL_CHARS), rows, columns);

    // Act and Assert
    expect(bytes.length).toBeLessThan(IMPORT_MAX_SHEET_CHARS / 10);
    await expect(xlsx.read(bytes, limits())).rejects.toBeInstanceOf(FileTypeError);
  });

  it('the same cells under the budget are read', async () => {
    // Arrange
    const bytes = sharedStringsXlsx(noiseOf(100), 3, 2);

    // Act
    const sheet = await xlsx.read(bytes, limits());

    // Assert
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows[0]?.cells[1]).toHaveLength(100);
  });
});
