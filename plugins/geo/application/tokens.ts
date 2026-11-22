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

/** The `GeoReferenceReader` port the province read service reads the tables through. */
export const GEO_REFERENCE_READER: unique symbol = Symbol('GeoReferenceReader');

/** The `ServedStores` port the signed per-store routes check their `storeId` through. */
export const SERVED_STORES: unique symbol = Symbol('GeoServedStores');

/** The `AvailabilityCache` of a store's narrowed wilayas. */
export const AVAILABILITY_CACHE: unique symbol = Symbol('GeoAvailabilityCache');
