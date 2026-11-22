import { isWilayaCode, MAX_DELIVERY_PRICE, type WilayaCode } from '@cod/shared';
import type { CommuneRateRow, WilayaRateRow } from './fee-group';

/**
 * One price a carrier bills (D3107, D3125): a wilaya's (`codeOns` null) or one commune's of that wilaya, since
 * Yalidine bills per commune. Whole DZD.
 */
export interface CarrierRate {
  readonly provinceCode: WilayaCode;
  readonly codeOns: number | null;
  readonly home: number;
  readonly desk: number;
}

/** What a carrier sync writes: every wilaya row (bases merged) and the commune rows whose base changed or is new. */
export interface CarrierPriceMerge {
  readonly rates: readonly WilayaRateRow[];
  readonly communeUpserts: readonly CommuneRateRow[];
}

/** A carrier rate of one commune. */
type CommuneCarrierRate = CarrierRate & { readonly codeOns: number };

const isCommuneRate = (rate: CarrierRate): rate is CommuneCarrierRate => rate.codeOns !== null;
const isPrice = (value: number): boolean => Number.isInteger(value) && value >= 0 && value <= MAX_DELIVERY_PRICE;
const isCommuneCode = (value: number): boolean => Number.isInteger(value) && value > 0;
const keyOf = (rate: CarrierRate): string =>
  rate.codeOns === null ? `w${rate.provinceCode}` : `c${String(rate.codeOns)}`;

/** Why a carrier's rates cannot be merged (a bad price, wilaya or commune code, a key named twice), or `null`. */
export function carrierRatesProblem(rates: readonly CarrierRate[]): string | null {
  const seen = new Set<string>();
  for (const rate of rates) {
    if (!isWilayaCode(rate.provinceCode)) return 'unknown wilaya';
    if (rate.codeOns !== null && !isCommuneCode(rate.codeOns)) return 'malformed commune code';
    if (!isPrice(rate.home) || !isPrice(rate.desk)) return 'price out of range';
    if (seen.has(keyOf(rate))) return 'rate named twice';
    seen.add(keyOf(rate));
  }
  return null;
}

/** A commune with the carrier's bases: the stored row's overrides and switches stay; a new row has only bases. */
function communeWithBases(stored: CommuneRateRow | undefined, rate: CommuneCarrierRate): CommuneRateRow {
  return {
    codeOns: rate.codeOns,
    provinceCode: rate.provinceCode,
    overrideHome: stored?.overrideHome ?? null,
    overrideDesk: stored?.overrideDesk ?? null,
    deliveryEnabled: stored?.deliveryEnabled ?? null,
    deskEnabled: stored?.deskEnabled ?? null,
    baseHome: rate.home,
    baseDesk: rate.desk,
  };
}

/**
 * A carrier sync (D3107, D3125): writes the carrier's prices as `base*` at wilaya and commune level and keeps every
 * `override*` and switch, so a merchant's edit survives. A wilaya or commune the carrier lacks keeps its base; a
 * wilaya the group has no row for gets none. Pure: the caller checked the rates with {@link carrierRatesProblem}.
 */
export function mergeCarrierPrices(
  rows: readonly WilayaRateRow[],
  communeRows: readonly CommuneRateRow[],
  carrierRates: readonly CarrierRate[],
): CarrierPriceMerge {
  const wilayaRates = new Map(
    carrierRates.filter((rate) => !isCommuneRate(rate)).map((rate) => [rate.provinceCode, rate]),
  );
  const rates = rows.map((row) => {
    const rate = wilayaRates.get(row.provinceCode);
    return rate === undefined ? row : { ...row, baseHome: rate.home, baseDesk: rate.desk };
  });
  const stored = new Map(communeRows.map((row) => [row.codeOns, row]));
  const communeUpserts = carrierRates
    .filter(isCommuneRate)
    .filter((rate) => {
      const row = stored.get(rate.codeOns);
      return row === undefined || row.baseHome !== rate.home || row.baseDesk !== rate.desk;
    })
    .map((rate) => communeWithBases(stored.get(rate.codeOns), rate));
  return { rates, communeUpserts };
}
