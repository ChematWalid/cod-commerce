import { type StoreId, toSnowflake, toStoreId, type WilayaCode } from '@cod/shared';
import type { AvailabilityCache } from '../../domain/ports/availability-cache.port';
import type { GeoReferenceReader } from '../../domain/ports/geo-reference-reader.port';
import type { ServedStores } from '../../domain/ports/served-stores.port';
import type { TownAvailability, TownAvailabilitySource } from '../../domain/ports/town-availability.port';
import type { GeoSeed } from '../../domain/geo-seed';

/** A {@link GeoReferenceReader} over a fixed reference, counting its reads. */
export class FixedGeoReferenceReader implements GeoReferenceReader {
  reads = 0;

  constructor(private readonly reference: GeoSeed) {}

  read(): Promise<GeoSeed> {
    this.reads += 1;
    return Promise.resolve(this.reference);
  }
}

/** {@link ServedStores} that serves only the listed store ids. */
export class ListedServedStores implements ServedStores {
  constructor(private readonly served: readonly string[]) {}

  servedStore(raw: unknown): Promise<StoreId | null> {
    if (typeof raw !== 'string' || !this.served.includes(raw)) return Promise.resolve(null);
    return Promise.resolve(toStoreId(toSnowflake(raw)));
  }
}

/** A {@link TownAvailabilitySource} with fixed answers per `storeId:provinceCode`, counting its calls. */
export class FixedTownAvailability implements TownAvailabilitySource {
  calls = 0;

  constructor(private readonly answers: ReadonlyMap<string, TownAvailability>) {}

  availabilityFor(storeId: StoreId, provinceCode: WilayaCode): Promise<TownAvailability | null> {
    this.calls += 1;
    return Promise.resolve(this.answers.get(`${storeId}:${provinceCode}`) ?? null);
  }
}

/** An {@link AvailabilityCache} that never expires. */
export class MapAvailabilityCache implements AvailabilityCache {
  private readonly entries = new Map<string, TownAvailability | null>();

  get(key: string): TownAvailability | null | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: TownAvailability | null): void {
    this.entries.set(key, value);
  }
}
