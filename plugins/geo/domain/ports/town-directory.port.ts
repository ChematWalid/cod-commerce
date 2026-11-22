import type { Town, WilayaCode } from '@cod/shared';

/**
 * Reads which communes belong to a wilaya, so delivery pricing can validate a commune rate's `codeOns` without a
 * database FK to geo's tables (D3118, D3125). Injected as `TOWN_DIRECTORY`; `ProvinceReadService` provides it from its cached read of `geo_town`.
 */
export interface TownDirectory {
  /** The ONS codes (`codeOns`) of the wilaya's communes; empty for a wilaya with no communes seeded. */
  townsOf(provinceCode: WilayaCode): Promise<readonly number[]>;
  /**
   * The wilaya's commune `codeOns` with its reference flags (`isStopdesk`, `isHomeDelivery`), for the shipping quote
   * (D3125); `undefined` for an unknown code or a commune of another wilaya.
   */
  townOf(provinceCode: WilayaCode, codeOns: number): Promise<Town | undefined>;
}
