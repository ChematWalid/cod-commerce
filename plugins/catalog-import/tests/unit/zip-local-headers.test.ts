import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { FileTypeError } from '../../domain/errors';
import { inspectZip } from '../../domain/zip-inspect';
import { localHeadersMatch } from '../../domain/zip-local-headers';
import { assertSafeParts } from '../../infrastructure/xml-guard';
import { XlsxSpreadsheetReader } from '../../infrastructure/xlsx-reader';
import { realZipOf, sheetXml, workbookFilesOf, type ZipFile } from '../support/real-zip';

const SHEET = sheetXml([
  ['name', 'price'],
  ['Shirt', '1500'],
]);
const DOCTYPE_SHEET = sheetXml([['name', 'price']], '<!DOCTYPE worksheet [<!ENTITY a "aaaaaaaaaa">]>');
/** A shared strings part exceljs would cache in full: well-formed, and deflating about 1 000 to 1. */
const STRINGS_BOMB =
  '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  `<si><t>${'a'.repeat(200_000)}</t></si></sst>`;
/** Text that deflates poorly, so its part stays under the ratio cap. */
const NOISE = Array.from({ length: 20_000 }, (_, index) => ((index * 7_919) % 9_973).toString(36)).join('');
const limits = { maxRows: 100, deadlineAt: Date.now() + 60_000, now: Date.now };

/** Whether exceljs's view of the zip (its local headers, in order) is the one the central directory gave. */
function matches(bytes: Uint8Array): boolean {
  const verdict = inspectZip(bytes);
  if (!verdict.ok) throw new Error('the test zip must pass the directory checks');
  return localHeadersMatch(bytes, verdict.entries, verdict.directoryOffset);
}

const zipWith = (extra: readonly ZipFile[], position: 'before' | 'after' = 'before'): Uint8Array =>
  realZipOf(position === 'before' ? [...extra, ...workbookFilesOf(SHEET)] : [...workbookFilesOf(SHEET), ...extra]);

describe('localHeadersMatch (D2266)', () => {
  it('an honest workbook matches its directory', () => {
    // Act and Assert
    expect(matches(realZipOf(workbookFilesOf(SHEET)))).toBe(true);
  });

  it('a workbook exceljs wrote (data descriptors, streaming writer) matches its directory', async () => {
    // Arrange
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('products').addRow(['name', 'price']);
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());

    // Act and Assert
    expect(matches(bytes)).toBe(true);
  });

  it('a signed data descriptor written by a streaming writer matches', () => {
    // Act and Assert
    expect(matches(realZipOf(workbookFilesOf(SHEET).map((file) => ({ ...file, descriptor: true }))))).toBe(true);
  });

  it('a local entry the directory omits (a smuggled shared strings bomb) is refused', () => {
    // Arrange
    const smuggled = { name: 'xl/sharedStrings.xml', text: 'a'.repeat(200_000), listedAs: null };

    // Act and Assert
    expect(matches(zipWith([smuggled]))).toBe(false);
    expect(matches(zipWith([smuggled], 'after'))).toBe(false);
  });

  it('a local entry listed under another name is refused', () => {
    // Act and Assert
    expect(matches(zipWith([{ name: 'xl/worksheets/sheet2.xml', text: SHEET, listedAs: 'xl/media/a.png' }]))).toBe(
      false,
    );
  });

  it('a descriptor signature inside the data, before its end, is refused', () => {
    // Arrange: a reader that looks for the signature would cut the entry there and read on from inside its data
    const early = { name: 'xl/media/a.bin', text: 'abcPK\u0007\u0008def', stored: true, descriptor: true };

    // Act and Assert
    expect(matches(zipWith([early]))).toBe(false);
  });
});

describe('XlsxSpreadsheetReader against a zip whose two views differ (D2266)', () => {
  it('a smuggled shared strings bomb is refused before exceljs reads it', async () => {
    // Arrange
    const bytes = zipWith([{ name: 'xl/sharedStrings.xml', text: STRINGS_BOMB, listedAs: null }]);

    // Act and Assert
    await expect(new XlsxSpreadsheetReader().read(bytes, limits)).rejects.toBeInstanceOf(FileTypeError);
  });
});

describe('assertSafeParts (D2222, D2266)', () => {
  const guard = (extra: ZipFile): (() => void) => {
    const bytes = zipWith([extra], 'after');
    const verdict = inspectZip(bytes);
    if (!verdict.ok) throw new Error('the test zip must pass the directory checks');
    return () => {
      assertSafeParts(bytes, verdict.entries);
    };
  };

  it('a DTD in a part exceljs reads as a sheet without a .xml ending is refused', () => {
    // Act and Assert: exceljs matches `xl/worksheets/sheet<n>.xml` anywhere in the name
    expect(guard({ name: 'xl/worksheets/sheet2.xml.bak', text: DOCTYPE_SHEET })).toThrow(FileTypeError);
  });

  it('a part of any name inflating past its claimed size is refused', () => {
    // Act and Assert
    expect(guard({ name: 'xl/media/image1.png', text: NOISE, claimedSize: NOISE.length / 2 })).toThrow(FileTypeError);
  });

  it('an honest media part passes', () => {
    // Act and Assert
    expect(guard({ name: 'xl/media/image1.png', text: NOISE })).not.toThrow();
  });
});
