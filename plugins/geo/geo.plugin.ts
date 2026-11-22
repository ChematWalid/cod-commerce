import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { type GeoLogger, GeoSeedService } from './application/geo-seed.service';
import {
  GEO_LOGGER,
  GEO_SEED,
  GEO_SEED_STORE,
  TOWN_AVAILABILITY,
  TOWN_AVAILABILITY_REGISTRAR,
} from './application/tokens';
import { newTownAvailabilityRegistry } from './application/town-availability.registry';
import { GEO_LOG_CONTEXT } from './domain/constants';
import type { GeoSeed } from './domain/geo-seed';
import type { GeoSeedStore } from './domain/ports/geo-seed-store.port';
import { GEO_ENTITIES } from './infrastructure/geo-entities';
import { loadGeoSeed } from './infrastructure/seed/load-geo-seed';
import { TypeOrmGeoSeedStore } from './infrastructure/typeorm-geo-seed.store';

const geoLogger: GeoLogger = {
  info: (message) => {
    Logger.info(message, GEO_LOG_CONTEXT);
  },
};

/**
 * Algeria's geo reference data: the wilayas and communes of law 26-06 (D3123), global tables that are not tenant
 * data (D3103). `GeoSeedService.converge()` upserts the seed on every migrate (D3116). This module also wires the
 * town availability seam; delivery pricing registers on its registrar token.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: GEO_ENTITIES,
  providers: [
    { provide: TOWN_AVAILABILITY, useFactory: newTownAvailabilityRegistry },
    { provide: TOWN_AVAILABILITY_REGISTRAR, useExisting: TOWN_AVAILABILITY },
    { provide: GEO_LOGGER, useValue: geoLogger },
    { provide: GEO_SEED, useFactory: loadGeoSeed },
    TypeOrmGeoSeedStore,
    { provide: GEO_SEED_STORE, useExisting: TypeOrmGeoSeedStore },
    {
      provide: GeoSeedService,
      useFactory: (store: GeoSeedStore, seed: GeoSeed, logger: GeoLogger) => new GeoSeedService(store, seed, logger),
      inject: [GEO_SEED_STORE, GEO_SEED, GEO_LOGGER],
    },
  ],
  exports: [TOWN_AVAILABILITY_REGISTRAR, GeoSeedService],
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GeoPlugin {}
