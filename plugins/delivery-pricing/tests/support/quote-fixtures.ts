import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';
import type { DeliveryQuoteInput, QuoteTown } from '../../domain/quote';

/** Alger's wilaya row: 600 home, 400 desk, both on, no override. */
export const WILAYA: WilayaRateRow = {
  provinceCode: '16',
  baseHome: 600,
  baseDesk: 400,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: true,
  deskEnabled: true,
};
export const NO_OVERWEIGHT = { chargeOverweight: false, overweightAllowanceKg: 5, overweightRate: 50 };
export const OVERWEIGHT = { ...NO_OVERWEIGHT, chargeOverweight: true };
export const STOPDESK_TOWN: QuoteTown = { isStopdesk: true };
export const HOME_ONLY_TOWN: QuoteTown = { isStopdesk: false };

/** A commune row of Alger Centre (1601) that inherits everything unless `fields` set it. */
export const commune = (fields: Partial<CommuneRateRow> = {}): CommuneRateRow => ({
  codeOns: 1601,
  provinceCode: '16',
  baseHome: null,
  baseDesk: null,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: null,
  deskEnabled: null,
  ...fields,
});

/** A quote of home delivery to Alger (600 home / 400 desk, both on), no commune, no weight, unwaived. */
export const input = (fields: Partial<DeliveryQuoteInput> = {}): DeliveryQuoteInput => ({
  group: NO_OVERWEIGHT,
  rate: WILAYA,
  communeRate: null,
  town: null,
  weightGrams: 0,
  method: 'home',
  waive: false,
  ...fields,
});

/** The unresolved quote, written out. */
export const UNRESOLVED = {
  baseFee: 0,
  overweightFee: 0,
  totalFee: 0,
  resolved: false,
  speed: null,
  offeredSpeeds: [],
  freeShipping: false,
  waivedFee: 0,
  source: null,
};
