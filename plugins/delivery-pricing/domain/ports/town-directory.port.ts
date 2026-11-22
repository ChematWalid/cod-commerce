import type { WilayaCode } from '@cod/shared';

/** Which communes belong to a wilaya: geo's `TownDirectory`, so a commune row needs no database FK (D3125). */
export interface TownDirectoryPort {
  /** The ONS codes of the wilaya's communes. */
  townsOf(provinceCode: WilayaCode): Promise<readonly number[]>;
}
