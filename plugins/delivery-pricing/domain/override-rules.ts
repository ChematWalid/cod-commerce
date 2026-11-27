import type { DeliveryFeeCommuneRateInput, DeliveryFeeRateInput, WilayaCode } from '@cod/shared';
import type { DefaultPrice } from './default-prices';
import type { CommuneRateRow, WilayaRateRow } from './fee-group';

/** Wilaya level (D3107): a typed price equal to the wilaya base stores no override. */
export const wilayaOverrideOf = (base: number, typed: number): number | null => (typed === base ? null : typed);

/**
 * Commune level (D3125): a typed price equal to the commune base stores no override; with no commune base any typed
 * price is one; an empty price (`null`) clears it, so the price falls back to the commune base, then the wilaya.
 */
export const communeOverrideOf = (base: number | null, typed: number | null): number | null =>
  typed === null || typed === base ? null : typed;

/**
 * The wilaya rows of a merchant's rates: each wilaya keeps its base (`baseOf`: the stored one, or the platform default
 * on a new group) and stores an override only where the typed price differs (D3107). Sync writes bases, never this.
 */
export function wilayaRowsOf(
  rates: readonly DeliveryFeeRateInput[],
  baseOf: (provinceCode: WilayaCode) => DefaultPrice,
): WilayaRateRow[] {
  return rates.map((rate) => {
    const base = baseOf(rate.provinceCode);
    return {
      provinceCode: rate.provinceCode,
      baseHome: base.home,
      baseDesk: base.desk,
      overrideHome: wilayaOverrideOf(base.home, rate.homePrice),
      overrideDesk: wilayaOverrideOf(base.desk, rate.deskPrice),
      deliveryEnabled: rate.deliveryEnabled,
      deskEnabled: rate.deskEnabled,
    };
  });
}

const isEmptyCommuneRow = (row: CommuneRateRow): boolean =>
  [row.baseHome, row.baseDesk, row.overrideHome, row.overrideDesk, row.deliveryEnabled, row.deskEnabled].every(
    (value) => value === null,
  );

/**
 * One commune merged with the merchant's edit (`setDeliveryFeeCommuneRates`, D3125): the overrides and switches are
 * the edit's, the base prices stay as stored (never written here). `null` when nothing is left, so the row goes.
 */
export function mergeCommuneRow(
  stored: CommuneRateRow | undefined,
  provinceCode: WilayaCode,
  edit: DeliveryFeeCommuneRateInput,
): CommuneRateRow | null {
  const baseHome = stored?.baseHome ?? null;
  const baseDesk = stored?.baseDesk ?? null;
  const merged: CommuneRateRow = {
    codeOns: edit.codeOns,
    provinceCode,
    baseHome,
    baseDesk,
    overrideHome: communeOverrideOf(baseHome, edit.homePrice),
    overrideDesk: communeOverrideOf(baseDesk, edit.deskPrice),
    deliveryEnabled: edit.deliveryEnabled,
    deskEnabled: edit.deskEnabled,
  };
  return isEmptyCommuneRow(merged) ? null : merged;
}
