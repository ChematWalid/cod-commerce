import { catalogImportEntry } from '@cod/plugin-catalog-import';

/** Forbidden: api/ goes through its own application ports, never the catalog-import entry (D2200). */
export const importInApi = catalogImportEntry;
