/**
 * Writes the sample import fixtures (brief deliverable "sample xlsx fixtures", D2209): 100 synthetic products,
 * alternately Arabic and English names, never real data. Re-run after a format change:
 *   node --experimental-strip-types plugins/catalog-import/tests/fixtures/generate-fixtures.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';

const ROWS = 100;
const HEADER = [
  'product_key',
  'name',
  'description',
  'status',
  'price',
  'old_price',
  'weight',
  'variant_sku',
  'image_urls',
];
const BOM = '\uFEFF';
const IMAGE_EVERY = 10;
const BASE_PRICE = 1000;
const PRICE_STEP = 10;
const BASE_WEIGHT = 100;
const KEY_DIGITS = 3;

/** The data rows the error fixture breaks, by their 1-based position among the data rows, and how. */
const BROKEN: Readonly<Record<number, (row: string[]) => void>> = {
  5: (row) => {
    row[4] = '-5';
  },
  17: (row) => {
    row[3] = 'archived';
  },
  33: (row) => {
    row[8] = 'ftp://img.example.com/x.jpg';
  },
  61: (row) => {
    row[1] = '';
  },
  88: (row) => {
    row[4] = 'free';
  },
};

function rowOf(index: number, prefix: string): string[] {
  const key = `${prefix}-${String(index).padStart(KEY_DIGITS, '0')}`;
  const name = index % 2 === 1 ? `منتج تجريبي ${String(index)}` : `Synthetic product ${String(index)}`;
  const image = index % IMAGE_EVERY === 0 ? `https://img.example.com/${key.toLowerCase()}.jpg` : '';
  return [
    key,
    name,
    '',
    'active',
    String(BASE_PRICE + index * PRICE_STEP),
    '',
    String(BASE_WEIGHT + index),
    key,
    image,
  ];
}

const rowsOf = (prefix: string): string[][] => Array.from({ length: ROWS }, (_, index) => rowOf(index + 1, prefix));

const csvOf = (rows: readonly (readonly string[])[]): string =>
  `${BOM}${[HEADER, ...rows].map((row) => row.join(',')).join('\r\n')}\r\n`;

async function main(): Promise<void> {
  // Run as a script (see above), so the script's own path names the fixtures folder.
  const directory = dirname(process.argv[1] ?? '.');
  writeFileSync(join(directory, 'products-100.csv'), csvOf(rowsOf('FX')));
  const broken = rowsOf('FXE').map((row, index) => {
    const copy = [...row];
    BROKEN[index + 1]?.(copy);
    return copy;
  });
  writeFileSync(join(directory, 'products-100-with-errors.csv'), csvOf(broken));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('products');
  sheet.addRow(HEADER);
  for (const row of rowsOf('FX')) {
    // Prices and weights as number cells, as a merchant's sheet holds them.
    sheet.addRow(row.map((cell, column) => (column === 4 || column === 6 ? Number(cell) : cell)));
  }
  writeFileSync(join(directory, 'products-100.xlsx'), new Uint8Array(await workbook.xlsx.writeBuffer()));
}

void main();
