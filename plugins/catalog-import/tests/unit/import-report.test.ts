import { CATALOG_IMPORT_ROW_ERRORS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ImportReportService } from '../../application/import-report.service';
import { errorReportKey } from '../../domain/object-keys';
import { spreadsheetFormats } from '../../infrastructure/spreadsheet-formats';
import { SCOPE } from '../support/scope';

const JOB_ID = '900000000000001';
const E = CATALOG_IMPORT_ROW_ERRORS;

/** The report written for `rows`, as text without its byte order mark, line by line. */
async function reportOf(rows: Parameters<ImportReportService['write']>[2]): Promise<string[]> {
  const objects = new Map<string, Uint8Array>();
  const storage = {
    write: (key: string, body: Uint8Array | AsyncIterable<Uint8Array>): Promise<void> => {
      if (!(body instanceof Uint8Array)) throw new Error('bytes only');
      objects.set(key, body);
      return Promise.resolve();
    },
  };
  await new ImportReportService({ storage, formats: spreadsheetFormats() }).write(SCOPE, JOB_ID, rows);
  const bytes = objects.get(errorReportKey(SCOPE, JOB_ID));
  if (bytes === undefined) throw new Error('no report written');
  return new TextDecoder('utf-8', { ignoreBOM: false })
    .decode(bytes)
    .split('\r\n')
    .filter((line) => line !== '');
}

describe('ImportReportService (D2210)', () => {
  it('error CSV lists row number and reason', async () => {
    // Act
    const lines = await reportOf([
      {
        rowNumber: 3,
        messages: [E.INVALID_VALUE, E.IMAGE_URL],
        values: { productKey: 'K-1', name: 'Shirt', variantSku: 'K-1-S', options: [], imageUrls: [] },
      },
      { rowNumber: 9, messages: [E.PRODUCT_NOT_FOUND], values: { productKey: 'id:77', options: [], imageUrls: [] } },
    ]);

    // Assert
    expect(lines).toEqual([
      'row,reasons,product_key,name,variant_sku',
      `3,${E.INVALID_VALUE};${E.IMAGE_URL},K-1,Shirt,K-1-S`,
      `9,${E.PRODUCT_NOT_FOUND},id:77,,`,
    ]);
  });

  it('a `=cmd|` cell in a bad row is escaped in the error report', async () => {
    // Act
    const lines = await reportOf([
      { rowNumber: 4, messages: [E.INVALID_VALUE], values: { name: "=cmd|' /C calc'!A0", options: [], imageUrls: [] } },
    ]);

    // Assert
    expect(lines[1]).toBe(`4,${E.INVALID_VALUE},,'=cmd|' /C calc'!A0,`);
  });

  it('writes nothing when no row failed', async () => {
    // Act and Assert
    await expect(reportOf([])).rejects.toThrow('no report written');
  });
});
