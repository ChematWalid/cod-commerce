import type { WilayaCode } from '@cod/shared';

/**
 * Reads which communes belong to a wilaya, so delivery pricing can validate a commune rate's `codeOns` without a
 * database FK to geo's tables (D3118, D3125). Injected as `TOWN_DIRECTORY`; geo provides it with its town entities.
 */
export interface TownDirectory {
  /** The ONS codes (`codeOns`) of the wilaya's communes; empty for a wilaya with no communes seeded. */
  townsOf(provinceCode: WilayaCode): Promise<readonly number[]>;
}
