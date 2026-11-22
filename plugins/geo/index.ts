export { GeoPlugin } from './geo.plugin';

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
