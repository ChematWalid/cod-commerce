/**
 * The town availability seam: delivery pricing registers its source on `TOWN_AVAILABILITY_REGISTRAR` on bootstrap,
 * and the provinces endpoint reads `TOWN_AVAILABILITY` (the same registry instance).
 */
export const TOWN_AVAILABILITY: unique symbol = Symbol('GeoTownAvailability');
export const TOWN_AVAILABILITY_REGISTRAR: unique symbol = Symbol('GeoTownAvailabilityRegistrar');

/** The `TownDirectory` read port delivery pricing injects to validate a commune's wilaya. */
export const TOWN_DIRECTORY: unique symbol = Symbol('GeoTownDirectory');
