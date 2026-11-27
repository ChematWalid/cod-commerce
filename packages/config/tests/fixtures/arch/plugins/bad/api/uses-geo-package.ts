import { geoEntry } from '@cod/plugin-geo';

/** Forbidden: api/ goes through its own application ports, never the geo entry (D3118). */
export const geoInApi = geoEntry;
