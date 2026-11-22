/**
 * The town availability seam: delivery pricing registers its source on `TOWN_AVAILABILITY_REGISTRAR` on bootstrap,
 * and the provinces endpoint reads `TOWN_AVAILABILITY` (the same registry instance).
 */
export const TOWN_AVAILABILITY: unique symbol = Symbol('GeoTownAvailability');
export const TOWN_AVAILABILITY_REGISTRAR: unique symbol = Symbol('GeoTownAvailabilityRegistrar');

/** The `TownDirectory` read port delivery pricing injects to validate a commune's wilaya. */
export const TOWN_DIRECTORY: unique symbol = Symbol('GeoTownDirectory');

/** The geo seed the seed service converges on, parsed once at boot. */
export const GEO_SEED: unique symbol = Symbol('GeoSeed');

/** The `GeoSeedStore` port the seed service writes through. */
export const GEO_SEED_STORE: unique symbol = Symbol('GeoSeedStore');

/** The `GeoLogger` the seed service reports through. */
export const GEO_LOGGER: unique symbol = Symbol('GeoLogger');
