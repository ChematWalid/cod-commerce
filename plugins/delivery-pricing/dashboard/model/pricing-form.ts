import { WILAYAS, type WilayaCode } from '@cod/shared';
import type { FeeGroupDto, FeeRateDto } from '../dto';

/**
 * One wilaya of the form: the prices as typed (text, so a half-typed value stays on screen), its switches, and the
 * base prices (platform default or carrier sync) a typed price is compared with (D3107).
 */
export interface PricingRow {
  readonly provinceCode: WilayaCode;
  readonly homePrice: string;
  readonly deskPrice: string;
  readonly deliveryEnabled: boolean;
  readonly deskEnabled: boolean;
  readonly baseHomePrice: number;
  readonly baseDeskPrice: number;
}

/** The pricing option editor's state; numbers stay text until the save parses them. */
export interface PricingForm {
  readonly name: string;
  /** Always null until carriers exist (P5.S1, D3109). */
  readonly carrierId: string | null;
  readonly chargeOverweight: boolean;
  readonly overweightAllowanceKg: string;
  readonly overweightRate: string;
  readonly rows: readonly PricingRow[];
}

type RowPrices = (rate: FeeRateDto) => Pick<PricingRow, 'homePrice' | 'deskPrice'>;

const effectivePrices: RowPrices = (rate) => ({ homePrice: String(rate.homePrice), deskPrice: String(rate.deskPrice) });
const basePrices: RowPrices = (rate) => ({
  homePrice: String(rate.baseHomePrice),
  deskPrice: String(rate.baseDeskPrice),
});

/** The rows of `group` in the order of `WILAYAS`; a wilaya the answer lacks is left out (the save then refuses). */
function rowsOf(group: FeeGroupDto, prices: RowPrices): PricingRow[] {
  const byCode = new Map(group.rates.map((rate) => [rate.provinceCode, rate]));
  return WILAYAS.flatMap(({ code }) => {
    const rate = byCode.get(code);
    if (rate === undefined) return [];
    return [
      {
        provinceCode: code,
        ...prices(rate),
        deliveryEnabled: rate.deliveryEnabled,
        deskEnabled: rate.deskEnabled,
        baseHomePrice: rate.baseHomePrice,
        baseDeskPrice: rate.baseDeskPrice,
      },
    ];
  });
}

const settingsOf = (group: FeeGroupDto) => ({
  chargeOverweight: group.chargeOverweight,
  overweightAllowanceKg: String(group.overweightAllowanceKg),
  overweightRate: String(group.overweightRate),
});

/** The form of a stored group: its effective prices (override ?? base). */
export function pricingFormOf(group: FeeGroupDto): PricingForm {
  return { name: group.name, carrierId: group.carrierId, ...settingsOf(group), rows: rowsOf(group, effectivePrices) };
}

/**
 * The form of a new pricing option: the store's "Platform default prices" table (`template`) at its base prices, so
 * nothing starts overridden (D3138), with its switches and overweight settings, no name and no carrier.
 */
export function newPricingFormOf(template: FeeGroupDto): PricingForm {
  return { name: '', carrierId: null, ...settingsOf(template), rows: rowsOf(template, basePrices) };
}

/** The whole DZD a typed price holds, or NaN when it is not a whole number. */
export function priceOf(text: string): number {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** Whether saving the row stores an override: a typed price differs from its base (D3107). */
export const rowOverridden = (row: PricingRow): boolean =>
  priceOf(row.homePrice) !== row.baseHomePrice || priceOf(row.deskPrice) !== row.baseDeskPrice;

/** What one row's edit may change. */
export type RowChange = Partial<Pick<PricingRow, 'homePrice' | 'deskPrice' | 'deliveryEnabled' | 'deskEnabled'>>;

/** `form` with the row of `provinceCode` changed. */
export function withRow(form: PricingForm, provinceCode: WilayaCode, change: RowChange): PricingForm {
  return { ...form, rows: form.rows.map((row) => (row.provinceCode === provinceCode ? { ...row, ...change } : row)) };
}

/** `form` with the row of `provinceCode` back at its base prices: saving it clears the override. */
export function withRowReset(form: PricingForm, provinceCode: WilayaCode): PricingForm {
  const row = form.rows.find((candidate) => candidate.provinceCode === provinceCode);
  if (row === undefined) return form;
  return withRow(form, provinceCode, { homePrice: String(row.baseHomePrice), deskPrice: String(row.baseDeskPrice) });
}
