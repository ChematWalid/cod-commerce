import type { Province, Town } from '@cod/shared';

/** A wilaya as the seed holds it: the API shape without its derived `id` and its `towns`. */
export type ProvinceSeed = Omit<Province, 'id' | 'towns'>;

/** A commune as the seed holds it: the API shape without its derived `id` (`String(codeOns)`). */
export type TownSeed = Omit<Town, 'id'>;

/** The geo reference data of law 26-06 (D3123): every wilaya and commune. */
export interface GeoSeed {
  readonly provinces: readonly ProvinceSeed[];
  readonly towns: readonly TownSeed[];
}

/** How many wilayas and communes one converge wrote. */
export interface GeoSeedCounts {
  readonly provinces: number;
  readonly towns: number;
}
