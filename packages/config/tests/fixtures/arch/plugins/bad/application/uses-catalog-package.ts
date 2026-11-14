import { catalogEntry } from '@cod/plugin-catalog';

/** Forbidden: application/ declares ports, it never imports the catalog entry (D2104). */
export const catalogInApplication = catalogEntry;
