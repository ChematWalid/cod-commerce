import type { GeoSeed } from '../geo-seed';

/** Reads the global `geo_province` and `geo_town` tables: every wilaya and commune the seed converged. */
export interface GeoReferenceReader {
  read(): Promise<GeoSeed>;
}
