import type { Provider } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { type GeoLogger, GeoSeedService } from '../application/geo-seed.service';
import { ProvinceReadService } from '../application/province-read.service';
import type { SingleSourceRegistry } from '../application/single-source.registry';
import {
  AVAILABILITY_CACHE,
  GEO_LOGGER,
  GEO_REFERENCE_READER,
  GEO_SEED,
  GEO_SEED_STORE,
  SERVED_STORES,
  TOWN_AVAILABILITY,
  TOWN_AVAILABILITY_REGISTRAR,
} from '../application/tokens';
import { newTownAvailabilityRegistry } from '../application/town-availability.registry';
import { GEO_LOG_CONTEXT } from '../domain/constants';
import type { GeoSeed } from '../domain/geo-seed';
import type { AvailabilityCache } from '../domain/ports/availability-cache.port';
import type { GeoReferenceReader } from '../domain/ports/geo-reference-reader.port';
import type { GeoSeedStore } from '../domain/ports/geo-seed-store.port';
import type { ServedStores } from '../domain/ports/served-stores.port';
import type { TownAvailabilitySource } from '../domain/ports/town-availability.port';
import { LruAvailabilityCache } from './lru-availability-cache';
import { loadGeoSeed } from './seed/load-geo-seed';
import { TenancyServedStores } from './tenancy-served-stores.adapter';
import { TypeOrmGeoReferenceReader } from './typeorm-geo-reference.reader';
import { TypeOrmGeoSeedStore } from './typeorm-geo-seed.store';

const geoLogger: GeoLogger = {
  info: (message) => {
    Logger.info(message, GEO_LOG_CONTEXT);
  },
};

/** The seed side: the parsed seed file, the upsert store and the converge service (D3116). */
const SEED_PROVIDERS: Provider[] = [
  { provide: GEO_LOGGER, useValue: geoLogger },
  { provide: GEO_SEED, useFactory: loadGeoSeed },
  TypeOrmGeoSeedStore,
  { provide: GEO_SEED_STORE, useExisting: TypeOrmGeoSeedStore },
  {
    provide: GeoSeedService,
    useFactory: (store: GeoSeedStore, seed: GeoSeed, logger: GeoLogger) => new GeoSeedService(store, seed, logger),
    inject: [GEO_SEED_STORE, GEO_SEED, GEO_LOGGER],
  },
];

/** The read side of the provinces routes: the tables, the served stores, the availability seam and its cache. */
const READ_PROVIDERS: Provider[] = [
  { provide: TOWN_AVAILABILITY, useFactory: newTownAvailabilityRegistry },
  { provide: TOWN_AVAILABILITY_REGISTRAR, useExisting: TOWN_AVAILABILITY },
  TypeOrmGeoReferenceReader,
  { provide: GEO_REFERENCE_READER, useExisting: TypeOrmGeoReferenceReader },
  TenancyServedStores,
  { provide: SERVED_STORES, useExisting: TenancyServedStores },
  { provide: AVAILABILITY_CACHE, useFactory: () => new LruAvailabilityCache() },
  {
    provide: ProvinceReadService,
    useFactory: (
      reader: GeoReferenceReader,
      stores: ServedStores,
      availability: SingleSourceRegistry<TownAvailabilitySource>,
      cache: AvailabilityCache,
    ) => new ProvinceReadService({ reader, stores, availability, cache }),
    inject: [GEO_REFERENCE_READER, SERVED_STORES, TOWN_AVAILABILITY, AVAILABILITY_CACHE],
  },
];

/** Every provider of the geo plugin. */
export const GEO_PROVIDERS: Provider[] = [...SEED_PROVIDERS, ...READ_PROVIDERS];
