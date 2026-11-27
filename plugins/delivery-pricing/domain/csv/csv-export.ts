import { guardCell, PRICING_CSV_COLUMNS, PRICING_CSV_SWITCH_OFF, PRICING_CSV_SWITCH_ON } from '@cod/shared';
import { PRICING_CSV_FILE_PREFIX, PRICING_CSV_FILE_SUFFIX } from '../constants';
import type { CommuneRateRow, FeeGroupHeader, FeeGroupRecord, WilayaRateRow } from '../fee-group';
import { communeValuesOf, wilayaValuesOf } from './csv-values';

/** An empty cell: a commune price or switch that inherits the wilaya's. */
const INHERITED = '';

const priceCell = (price: number | null): string => (price === null ? INHERITED : String(price));
const switchCell = (enabled: boolean | null): string => {
  if (enabled === null) return INHERITED;
  return enabled ? PRICING_CSV_SWITCH_ON : PRICING_CSV_SWITCH_OFF;
};

function wilayaRecord(row: WilayaRateRow): string[] {
  const values = wilayaValuesOf(row);
  return [
    'wilaya',
    row.provinceCode,
    INHERITED,
    priceCell(values.homePrice),
    priceCell(values.deskPrice),
    switchCell(values.deliveryEnabled),
    switchCell(values.deskEnabled),
  ];
}

function communeRecord(row: CommuneRateRow): string[] {
  const values = communeValuesOf(row);
  return [
    'commune',
    row.provinceCode,
    String(row.codeOns),
    priceCell(values.homePrice),
    priceCell(values.deskPrice),
    switchCell(values.deliveryEnabled),
    switchCell(values.deskEnabled),
  ];
}

/**
 * The records of a group's CSV export (D3142): the header, then each wilaya in code order followed by its stored
 * commune rows in ONS order, with effective prices (override ?? base); an empty commune cell inherits. Every cell goes
 * through the formula guard (D2209), so the file round-trips through the import as no change.
 */
export function pricingCsvRecordsOf(group: FeeGroupRecord): string[][] {
  const rates = [...group.rates].sort((left, right) => left.provinceCode.localeCompare(right.provinceCode));
  const communes = [...group.communeRates].sort((left, right) => left.codeOns - right.codeOns);
  const records = rates.flatMap((rate) => [
    wilayaRecord(rate),
    ...communes.filter((row) => row.provinceCode === rate.provinceCode).map(communeRecord),
  ]);
  return [[...PRICING_CSV_COLUMNS], ...records].map((record) => record.map(guardCell));
}

/** The export's file name: the group id only, since a merchant-typed name could carry any character. */
export const pricingCsvFileNameOf = (group: Pick<FeeGroupHeader, 'id'>): string =>
  `${PRICING_CSV_FILE_PREFIX}${group.id}${PRICING_CSV_FILE_SUFFIX}`;
