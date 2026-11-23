import { type Town, WILAYAS, type WilayaCode } from '@cod/shared';
import type { CommuneRateDto, FeeGroupDto, FeeRateDto } from '../../dashboard/dto';

/** Base prices of every wilaya in the fixtures: home 700, desk 400 DZD. */
export const FIXTURE_BASE_HOME = 700;
export const FIXTURE_BASE_DESK = 400;

/** One wilaya at its base prices, delivered with a stop desk, unless `change` says otherwise. */
export const rateOf = (provinceCode: WilayaCode, change: Partial<FeeRateDto> = {}): FeeRateDto => ({
  provinceCode,
  homePrice: FIXTURE_BASE_HOME,
  deskPrice: FIXTURE_BASE_DESK,
  baseHomePrice: FIXTURE_BASE_HOME,
  baseDeskPrice: FIXTURE_BASE_DESK,
  deliveryEnabled: true,
  deskEnabled: true,
  overridden: false,
  ...change,
});

/** A stored fee group with one rate per wilaya of `WILAYAS`; `rates` replaces some of them by code. */
export function groupOf(change: Partial<Omit<FeeGroupDto, 'rates'>> = {}, rates: readonly FeeRateDto[] = []) {
  const byCode = new Map(rates.map((rate) => [rate.provinceCode, rate]));
  const group: FeeGroupDto = {
    id: '1001',
    name: 'Platform default prices',
    carrierId: null,
    chargeOverweight: false,
    overweightAllowanceKg: 5,
    overweightRate: 50,
    isPlatformDefault: true,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    rates: WILAYAS.map(({ code }) => byCode.get(code) ?? rateOf(code)),
    communeRates: [],
    ...change,
  };
  return group;
}

/** A stored commune row with nothing set, unless `change` says otherwise. */
export const communeRateOf = (
  codeOns: number,
  provinceCode: WilayaCode,
  change: Partial<CommuneRateDto> = {},
): CommuneRateDto => ({
  codeOns,
  provinceCode,
  homePrice: null,
  deskPrice: null,
  baseHomePrice: null,
  baseDeskPrice: null,
  deliveryEnabled: null,
  deskEnabled: null,
  overridden: false,
  ...change,
});

/** A commune of the geo reference data. */
export const townOf = (codeOns: number, provinceCode: WilayaCode, isStopdesk = true): Town => ({
  id: String(codeOns),
  provinceCode,
  name: `Town ${String(codeOns)}`,
  arabicName: `بلدية ${String(codeOns)}`,
  names: [],
  codeOns,
  isStopdesk,
  isHomeDelivery: true,
});
