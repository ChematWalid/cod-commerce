import { catalogEntry } from '@cod/plugin-catalog';

/** Refused: a frontend is an API client and never imports the catalog's server services (ADR 0017, D2104). */
export const leaked = catalogEntry;
