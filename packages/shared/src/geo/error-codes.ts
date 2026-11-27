/** Stable error codes of the geo API (`/provinces`, `/store/provinces`); clients map them to translated messages. */
export const GEO_ERROR_CODES = {
  PROVINCE_NOT_FOUND: 'geo.province-not-found',
  STORE_NOT_FOUND: 'geo.store-not-found',
} as const;

/** One of the {@link GEO_ERROR_CODES} values. */
export type GeoErrorCode = (typeof GEO_ERROR_CODES)[keyof typeof GEO_ERROR_CODES];
