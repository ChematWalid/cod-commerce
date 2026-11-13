/** The headers of an internally signed request (D111). */
export const INTERNAL_AUTH_HEADERS = {
  kid: 'x-internal-kid',
  timestamp: 'x-internal-ts',
  signature: 'x-internal-sig',
  storeId: 'x-store-id',
  clientIp: 'x-client-ip',
  clientCountry: 'x-client-country',
} as const;

/**
 * How far a timestamp may be from the verifier's clock, each way. It is also the replay bound: there is no nonce, so
 * a captured request is accepted again until its timestamp leaves this window (ADR 0008).
 */
export const INTERNAL_AUTH_MAX_SKEW_SECONDS = 60;

/** The first line of the canonical string; a change of format changes it. */
export const INTERNAL_AUTH_VERSION = 'cod-internal-v1';
