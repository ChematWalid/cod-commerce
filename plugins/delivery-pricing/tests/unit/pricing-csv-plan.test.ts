import { PRICING_CSV_COLUMNS, toSnowflake, type WilayaCode } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type CsvImportContext, planCsvImport } from '../../domain/csv/csv-import-plan';
import { InvalidPricingCsvFileError } from '../../domain/errors';
import type { CommuneRateRow, FeeGroupRecord, WilayaRateRow } from '../../domain/fee-group';

const HEADER = [...PRICING_CSV_COLUMNS];

const wilaya = (provinceCode: WilayaCode, fields: Partial<WilayaRateRow> = {}): WilayaRateRow => ({
  provinceCode,
  baseHome: 500,
  baseDesk: 400,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: true,
  deskEnabled: true,
  ...fields,
});

const commune = (codeOns: number, fields: Partial<CommuneRateRow> = {}): CommuneRateRow => ({
  codeOns,
  provinceCode: '16',
  baseHome: null,
  baseDesk: null,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: null,
  deskEnabled: null,
  ...fields,
});

/** A group holding Adrar (01) and Alger (16), with Alger-Centre (1601) at a home override of 450. */
function context(fields: Partial<FeeGroupRecord> = {}): CsvImportContext {
  const group: FeeGroupRecord = {
    id: toSnowflake('1000000000000000101'),
    name: 'Standard',
    carrierId: null,
    chargeOverweight: false,
    overweightAllowanceKg: 5,
    overweightRate: 50,
    isPlatformDefault: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    rates: [wilaya('01', { baseHome: 1100, baseDesk: 600 }), wilaya('16')],
    communeRates: [commune(1601, { overrideHome: 450 })],
    ...fields,
  };
  const provinceOfTown = new Map<number, WilayaCode>([
    [101, '01'],
    [1601, '16'],
    [1652, '16'],
  ]);
  return { group, provinceOfTown };
}

const plan = (rows: readonly (readonly string[])[], ctx = context()) => planCsvImport([HEADER, ...rows], ctx);

describe('planCsvImport: wilaya rows', () => {
  it('stores a typed price as an override of the kept base and a switch as typed', () => {
    // Act
    const result = plan([['wilaya', '16', '', '650', '400', 'true', 'FALSE']]);

    // Assert
    expect(result.issues).toEqual([]);
    expect(result.wilayaRows).toEqual([wilaya('16', { overrideHome: 650, deskEnabled: false })]);
    expect(result.changes).toEqual([
      {
        level: 'wilaya',
        provinceCode: '16',
        codeOns: null,
        before: { homePrice: 500, deskPrice: 400, deliveryEnabled: true, deskEnabled: true },
        after: { homePrice: 650, deskPrice: 400, deliveryEnabled: true, deskEnabled: false },
      },
    ]);
  });

  it('clears an override when the typed price equals the base', () => {
    // Arrange
    const ctx = context({ rates: [wilaya('16', { overrideHome: 700 })] });

    // Act
    const result = plan([['wilaya', '16', '', '500', '400', 'true', 'true']], ctx);

    // Assert
    expect(result.wilayaRows).toEqual([wilaya('16')]);
  });

  it('answers no change for a row as stored', () => {
    // Act
    const result = plan([['wilaya', '16', '', '500', '400', 'true', 'true']]);

    // Assert
    expect(result).toMatchObject({ rows: 1, changes: [], wilayaRows: [], issues: [] });
  });

  it('reads a one-digit wilaya code, as a spreadsheet shows "01"', () => {
    // Act
    const result = plan([['wilaya', '1', '', '1200', '600', 'true', 'true']]);

    // Assert
    expect(result.wilayaRows).toEqual([wilaya('01', { baseHome: 1100, baseDesk: 600, overrideHome: 1200 })]);
  });

  it('trims the spaces around a cell', () => {
    // Act
    const result = plan([[' wilaya ', ' 16', '', ' 650 ', '400', 'true', 'true']]);

    // Assert
    expect(result.issues).toEqual([]);
    expect(result.wilayaRows).toEqual([wilaya('16', { overrideHome: 650 })]);
  });
});

describe('planCsvImport: commune rows', () => {
  it('merges a commune: a typed price differing from its base is an override, an empty cell inherits', () => {
    // Act
    const result = plan([['commune', '16', '1652', '480', '', '', 'false']]);

    // Assert
    expect(result.communeChange).toEqual({
      upserts: [commune(1652, { overrideHome: 480, deskEnabled: false })],
      removals: [],
    });
    expect(result.changes).toEqual([
      {
        level: 'commune',
        provinceCode: '16',
        codeOns: 1652,
        before: null,
        after: { homePrice: 480, deskPrice: null, deliveryEnabled: null, deskEnabled: false },
      },
    ]);
  });

  it('removes a stored commune row the file leaves empty', () => {
    // Act
    const result = plan([['commune', '16', '1601', '', '', '', '']]);

    // Assert
    expect(result.communeChange).toEqual({ upserts: [], removals: [1601] });
    expect(result.changes).toEqual([expect.objectContaining({ codeOns: 1601, after: null })]);
  });

  it('keeps a stored commune the file does not name', () => {
    // Act
    const result = plan([['commune', '16', '1652', '480', '', '', '']]);

    // Assert
    expect(result.communeChange.removals).toEqual([]);
    expect(result.communeChange.upserts.map((row) => row.codeOns)).toEqual([1652]);
  });

  it('stores no override for a typed price equal to the commune base', () => {
    // Arrange
    const ctx = context({ communeRates: [commune(1601, { baseHome: 450 })] });

    // Act
    const result = plan([['commune', '16', '1601', '450', '', '', '']], ctx);

    // Assert
    expect(result).toMatchObject({ changes: [], communeChange: { upserts: [], removals: [] } });
  });
});

describe('planCsvImport: refused rows', () => {
  it.each([
    ['an unknown level', ['region', '16', '', '1', '1', 'true', 'true'], 'level', 'invalid-level'],
    [
      'a wilaya the group holds no row of',
      ['wilaya', '31', '', '1', '1', 'true', 'true'],
      'provinceCode',
      'unknown-wilaya',
    ],
    [
      'a wilaya code that is no number',
      ['wilaya', 'Alger', '', '1', '1', 'true', 'true'],
      'provinceCode',
      'unknown-wilaya',
    ],
    ['a three-digit wilaya code', ['wilaya', '016', '', '1', '1', 'true', 'true'], 'provinceCode', 'unknown-wilaya'],
    [
      'a commune code on a wilaya row',
      ['wilaya', '16', '1601', '1', '1', 'true', 'true'],
      'codeOns',
      'unexpected-commune',
    ],
    ['an unknown commune', ['commune', '16', '9999', '1', '', '', ''], 'codeOns', 'unknown-commune'],
    ['a commune code that is no number', ['commune', '16', '16O1', '1', '', '', ''], 'codeOns', 'unknown-commune'],
    ['a commune row without a commune', ['commune', '16', '', '1', '', '', ''], 'codeOns', 'unknown-commune'],
    ['a commune of another wilaya', ['commune', '16', '101', '1', '', '', ''], 'codeOns', 'commune-not-in-wilaya'],
    ['a decimal price', ['wilaya', '16', '', '500.5', '400', 'true', 'true'], 'homePrice', 'invalid-price'],
    ['a negative price', ['wilaya', '16', '', '-5', '400', 'true', 'true'], 'homePrice', 'invalid-price'],
    ['a price above the bound', ['wilaya', '16', '', '100001', '400', 'true', 'true'], 'homePrice', 'invalid-price'],
    [
      'a guarded formula, read unguarded',
      ['wilaya', '16', '', "'=1+1", '400', 'true', 'true'],
      'homePrice',
      'invalid-price',
    ],
    [
      'a guarded negative price, read unguarded',
      ['wilaya', '16', '', "'-5", '400', 'true', 'true'],
      'homePrice',
      'invalid-price',
    ],
    ['a commune price that is no number', ['commune', '16', '1652', '', 'abc', '', ''], 'deskPrice', 'invalid-price'],
    [
      'a switch that is no boolean',
      ['wilaya', '16', '', '500', '400', 'yes', 'true'],
      'deliveryEnabled',
      'invalid-switch',
    ],
    ['an empty wilaya price', ['wilaya', '16', '', '', '400', 'true', 'true'], 'homePrice', 'missing-value'],
    ['an empty wilaya switch', ['wilaya', '16', '', '500', '400', 'true', ''], 'deskEnabled', 'missing-value'],
  ])('refuses %s, naming its row and column', (_label, row, column, issue) => {
    // Act
    const result = plan([row]);

    // Assert
    expect(result.issues).toEqual([{ row: 2, column, issue }]);
    expect(result).toMatchObject({ wilayaRows: [], communeChange: { upserts: [], removals: [] } });
  });

  it('refuses a wilaya or a commune named twice, keeping the first', () => {
    // Act
    const result = plan([
      ['wilaya', '16', '', '650', '400', 'true', 'true'],
      ['commune', '16', '1652', '480', '', '', ''],
      ['wilaya', '16', '', '700', '400', 'true', 'true'],
      ['commune', '16', '1652', '490', '', '', ''],
    ]);

    // Assert
    expect(result.issues).toEqual([
      { row: 4, column: 'provinceCode', issue: 'duplicate-key' },
      { row: 5, column: 'codeOns', issue: 'duplicate-key' },
    ]);
    expect(result.wilayaRows).toEqual([wilaya('16', { overrideHome: 650 })]);
  });

  it('numbers rows as records with the header as row 1, and skips blank records without counting them', () => {
    // Act
    const result = plan([
      ['wilaya', '16', '', '500', '400', 'true', 'true'],
      ['', ' ', '', '', '', '', ''],
      ['wilaya', '01', '', 'x', '600', 'true', 'true'],
    ]);

    // Assert
    expect(result.rows).toBe(2);
    expect(result.issues).toEqual([{ row: 4, column: 'homePrice', issue: 'invalid-price' }]);
  });
});

describe('planCsvImport: the header', () => {
  it('reads the columns by name in any order and letter case, ignoring others', () => {
    // Arrange
    const header = [
      'Note',
      'deskEnabled',
      'DELIVERYENABLED',
      'deskPrice',
      'homePrice',
      'codeOns',
      'provinceCode',
      'level',
    ];

    // Act
    const result = planCsvImport([header, ['x', 'true', 'true', '400', '650', '', '16', 'wilaya']], context());

    // Assert
    expect(result.wilayaRows).toEqual([wilaya('16', { overrideHome: 650 })]);
  });

  it.each([
    ['no record at all', []],
    ['a missing column', [HEADER.slice(1)]],
    ['a column named twice', [[...HEADER, 'level']]],
  ])('refuses the file for %s', (_label, records) => {
    // Act and Assert
    expect(() => planCsvImport(records, context())).toThrow(InvalidPricingCsvFileError);
  });
});
