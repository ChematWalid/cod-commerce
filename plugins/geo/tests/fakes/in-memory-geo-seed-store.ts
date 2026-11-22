import type { GeoSeed, GeoSeedCounts } from '../../domain/geo-seed';
import type { GeoSeedStore } from '../../domain/ports/geo-seed-store.port';

/** A {@link GeoSeedStore} that keeps the upserted rows by key, as the tables do. */
export class InMemoryGeoSeedStore implements GeoSeedStore {
  readonly provinces = new Map<string, GeoSeed['provinces'][number]>();
  readonly towns = new Map<number, GeoSeed['towns'][number]>();

  upsert(seed: GeoSeed): Promise<GeoSeedCounts> {
    for (const province of seed.provinces) this.provinces.set(province.code, province);
    for (const town of seed.towns) this.towns.set(town.codeOns, town);
    return Promise.resolve({ provinces: seed.provinces.length, towns: seed.towns.length });
  }
}
