import type { WilayaCode } from '@cod/shared';

/** What the quote reads of a commune in geo's reference data: whether a stop desk and home delivery are there (D3125). */
export interface TownReference {
  readonly isStopdesk: boolean;
  readonly isHomeDelivery: boolean;
}

/** Which communes belong to a wilaya: geo's `TownDirectory`, so a commune row needs no database FK (D3125). */
export interface TownDirectoryPort {
  /** The ONS codes of the wilaya's communes. */
  townsOf(provinceCode: WilayaCode): Promise<readonly number[]>;
  /** The commune `codeOns` of the wilaya, or `undefined` when it is unknown or of another wilaya. */
  townOf(provinceCode: WilayaCode, codeOns: number): Promise<TownReference | undefined>;
}
