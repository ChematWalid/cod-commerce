import type { DeliveryFeeCsvValues } from '@cod/shared';
import type { CommuneRateRow, WilayaRateRow } from '../fee-group';

/** A wilaya row's effective prices (override ?? base) and switches, as a CSV row and its diff show them. */
export const wilayaValuesOf = (row: WilayaRateRow): DeliveryFeeCsvValues => ({
  homePrice: row.overrideHome ?? row.baseHome,
  deskPrice: row.overrideDesk ?? row.baseDesk,
  deliveryEnabled: row.deliveryEnabled,
  deskEnabled: row.deskEnabled,
});

/** A commune row's effective prices and switches; `null` inherits the wilaya's (D3125). */
export const communeValuesOf = (row: CommuneRateRow): DeliveryFeeCsvValues => ({
  homePrice: row.overrideHome ?? row.baseHome,
  deskPrice: row.overrideDesk ?? row.baseDesk,
  deliveryEnabled: row.deliveryEnabled,
  deskEnabled: row.deskEnabled,
});
