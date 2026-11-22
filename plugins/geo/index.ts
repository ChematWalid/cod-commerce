export { GeoPlugin } from './geo.plugin';

// The seed the migrate role and `pnpm seed:geo` converge (D3116), and the global tables it writes (D3103).
export { GeoSeedService, type GeoSeedReport } from './application/geo-seed.service';
export { GeoProvinceEntity } from './infrastructure/province.entity';
export { GeoTownEntity } from './infrastructure/town.entity';

// The town availability seam: delivery pricing injects the registrar token and calls `register(source)` on bootstrap.
export { TOWN_AVAILABILITY_REGISTRAR } from './application/tokens';
export type {
  ModeAvailability,
  TownAvailability,
  TownAvailabilityRegistrar,
  TownAvailabilitySource,
} from './domain/ports/town-availability.port';

// The town directory read port: delivery pricing injects `TOWN_DIRECTORY` to check a commune belongs to its wilaya.
export { TOWN_DIRECTORY } from './application/tokens';
export type { TownDirectory } from './domain/ports/town-directory.port';
