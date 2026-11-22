export { GeoPlugin } from './geo.plugin';

// The town availability seam: delivery pricing injects the registrar token and calls `register(source)` on bootstrap.
export { TOWN_AVAILABILITY_REGISTRAR } from './application/tokens';
export type {
  TownAvailability,
  TownAvailabilityRegistrar,
  TownAvailabilitySource,
} from './domain/ports/town-availability.port';
