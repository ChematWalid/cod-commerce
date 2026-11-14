import { catalogEntry } from '@cod/plugin-catalog';

/** Forbidden: api/ goes through its own application ports, never the catalog entry (D2104). */
export const catalogInApi = catalogEntry;
