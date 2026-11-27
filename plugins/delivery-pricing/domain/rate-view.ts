import type { DeliveryFeeCommuneRate, DeliveryFeeRate } from '@cod/shared';
import type { CommuneRateRow, WilayaRateRow } from './fee-group';

/**
 * A wilaya row as the API answers it: the effective price is override ?? base (D3107), and `overridden` means an
 * override is stored, never "price ≠ base" (D3125).
 */
export const wilayaRateView = (row: WilayaRateRow): DeliveryFeeRate => ({
  provinceCode: row.provinceCode,
  homePrice: row.overrideHome ?? row.baseHome,
  deskPrice: row.overrideDesk ?? row.baseDesk,
  baseHomePrice: row.baseHome,
  baseDeskPrice: row.baseDesk,
  deliveryEnabled: row.deliveryEnabled,
  deskEnabled: row.deskEnabled,
  overridden: row.overrideHome !== null || row.overrideDesk !== null,
});

/** A commune row as the API answers it: override ?? base, `null` meaning the wilaya's price or switch (D3125). */
export const communeRateView = (row: CommuneRateRow): DeliveryFeeCommuneRate => ({
  codeOns: row.codeOns,
  provinceCode: row.provinceCode,
  homePrice: row.overrideHome ?? row.baseHome,
  deskPrice: row.overrideDesk ?? row.baseDesk,
  baseHomePrice: row.baseHome,
  baseDeskPrice: row.baseDesk,
  deliveryEnabled: row.deliveryEnabled,
  deskEnabled: row.deskEnabled,
  overridden: row.overrideHome !== null || row.overrideDesk !== null,
});
