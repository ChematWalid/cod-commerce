import { PRICING_CSV_COLUMNS, toSnowflake, type WilayaCode } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { pricingCsvFileNameOf, pricingCsvRecordsOf } from '../../domain/csv/csv-export';
import { planCsvImport } from '../../domain/csv/csv-import-plan';
import type { CommuneRateRow, FeeGroupRecord, WilayaRateRow } from '../../domain/fee-group';

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

const commune = (codeOns: number, provinceCode: WilayaCode, fields: Partial<CommuneRateRow> = {}): CommuneRateRow => ({
  codeOns,
  provinceCode,
  baseHome: null,
  baseDesk: null,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: null,
  deskEnabled: null,
  ...fields,
});

const GROUP: FeeGroupRecord = {
  id: toSnowflake('1000000000000000101'),
  name: '=HYPERLINK("x")',
  carrierId: null,
  chargeOverweight: false,
  overweightAllowanceKg: 5,
  overweightRate: 50,
  isPlatformDefault: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  rates: [wilaya('16', { overrideHome: 650, deskEnabled: false }), wilaya('01', { baseHome: 1100, baseDesk: 600 })],
  communeRates: [
    commune(1652, '16', { baseHome: 520, deliveryEnabled: false }),
    commune(1601, '16', { overrideHome: 450 }),
    commune(101, '01', { overrideDesk: 700 }),
  ],
};

describe('pricingCsvRecordsOf', () => {
  it('writes the header, then each wilaya in code order followed by its communes, with effective prices', () => {
    // Act
    const records = pricingCsvRecordsOf(GROUP);

    // Assert
    expect(records).toEqual([
      [...PRICING_CSV_COLUMNS],
      ['wilaya', '01', '', '1100', '600', 'true', 'true'],
      ['commune', '01', '101', '', '700', '', ''],
      ['wilaya', '16', '', '650', '400', 'true', 'false'],
      ['commune', '16', '1601', '450', '', '', ''],
      ['commune', '16', '1652', '520', '', 'false', ''],
    ]);
  });

  it('reads back as no change', () => {
    // Arrange
    const provinceOfTown = new Map<number, WilayaCode>([
      [101, '01'],
      [1601, '16'],
      [1652, '16'],
    ]);

    // Act
    const plan = planCsvImport(pricingCsvRecordsOf(GROUP), { group: GROUP, provinceOfTown });

    // Assert
    expect(plan).toMatchObject({ rows: 5, issues: [], changes: [] });
  });

  it('names the file after the group id, never its name', () => {
    // Act and Assert
    expect(pricingCsvFileNameOf(GROUP)).toBe('delivery-pricing-1000000000000000101.csv');
  });
});
