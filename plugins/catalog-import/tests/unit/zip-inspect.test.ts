import { IMPORT_MAX_UNCOMPRESSED_BYTES, IMPORT_MAX_ZIP_ENTRIES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { inspectZip } from '../../domain/zip-inspect';
import { XLSX_ENTRIES, zipOf } from '../support/zip-builder';

describe('inspectZip (D2222)', () => {
  it('accepts a small xlsx and lists its entries', () => {
    // Act
    const verdict = inspectZip(zipOf(XLSX_ENTRIES));

    // Assert
    expect(verdict).toEqual({
      ok: true,
      entries: XLSX_ENTRIES.map(({ name, compressed, uncompressed }) => ({
        name,
        compressedSize: compressed,
        uncompressedSize: uncompressed,
      })),
    });
  });

  it('deflate bomb refused before parse', () => {
    // Arrange: one sheet claiming 4 GiB out of 4 MiB
    const bomb = zipOf([
      ...XLSX_ENTRIES.slice(0, 2),
      { name: 'xl/worksheets/sheet1.xml', compressed: 4_194_304, uncompressed: 4_294_967_294 },
    ]);

    // Act and Assert
    expect(inspectZip(bomb)).toMatchObject({ ok: false });
  });

  it('more than 200 entries refused', () => {
    // Arrange
    const many = Array.from({ length: IMPORT_MAX_ZIP_ENTRIES - 2 }, (_, index) => ({
      name: `xl/media/image${String(index)}.png`,
      compressed: 10,
      uncompressed: 10,
    }));

    // Act and Assert
    expect(inspectZip(zipOf([...XLSX_ENTRIES, ...many]))).toEqual({ ok: false, reason: 'too-many-entries' });
    expect(inspectZip(zipOf([...XLSX_ENTRIES, ...many.slice(1)]))).toMatchObject({ ok: true });
  });

  it('missing xl/workbook.xml refused', () => {
    // Arrange
    const noWorkbook = zipOf(XLSX_ENTRIES.filter((entry) => entry.name !== 'xl/workbook.xml'));

    // Act and Assert
    expect(inspectZip(noWorkbook)).toEqual({ ok: false, reason: 'no-workbook' });
  });

  it('a ratio above 100:1 refused', () => {
    // Arrange
    const dense = zipOf([...XLSX_ENTRIES, { name: 'xl/sharedStrings.xml', compressed: 1_000, uncompressed: 100_001 }]);
    const atLimit = zipOf([
      ...XLSX_ENTRIES,
      { name: 'xl/sharedStrings.xml', compressed: 1_000, uncompressed: 100_000 },
    ]);

    // Act and Assert
    expect(inspectZip(dense)).toEqual({ ok: false, reason: 'ratio' });
    expect(inspectZip(atLimit)).toMatchObject({ ok: true });
  });

  it('a total above 50 MiB uncompressed refused even at a fair ratio', () => {
    // Arrange
    const sheets = Array.from({ length: 3 }, (_, index) => ({
      name: `xl/worksheets/sheet${String(index + 2)}.xml`,
      compressed: IMPORT_MAX_UNCOMPRESSED_BYTES / 100,
      uncompressed: IMPORT_MAX_UNCOMPRESSED_BYTES / 2,
    }));

    // Act and Assert
    expect(inspectZip(zipOf([...XLSX_ENTRIES, ...sheets]))).toEqual({ ok: false, reason: 'too-large' });
  });

  it('an entry with nothing compressed but bytes claimed refused', () => {
    // Act and Assert
    expect(inspectZip(zipOf([...XLSX_ENTRIES, { name: 'xl/x.xml', compressed: 0, uncompressed: 5 }]))).toEqual({
      ok: false,
      reason: 'ratio',
    });
  });

  it.each([
    ['plain text', new TextEncoder().encode('name,price\nshirt,1500\n')],
    ['a cut directory', zipOf(XLSX_ENTRIES).slice(0, -30)],
    ['nothing', new Uint8Array([])],
  ])('%s is not a zip', (_name, bytes) => {
    // Act and Assert
    expect(inspectZip(bytes)).toEqual({ ok: false, reason: 'not-a-zip' });
  });
});
