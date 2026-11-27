import type { GeoSeed, GeoSeedCounts } from '../geo-seed';

/** Writes the geo seed into the global `geo_province` and `geo_town` tables. */
export interface GeoSeedStore {
  /**
   * Inserts every wilaya and commune of `seed` and updates the names and flags of those already there, in one
   * transaction. A row absent from `seed` is never deleted: orders reference communes (D3116).
   */
  upsert(seed: GeoSeed): Promise<GeoSeedCounts>;
}
