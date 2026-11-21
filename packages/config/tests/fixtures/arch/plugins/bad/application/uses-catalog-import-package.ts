import { catalogImportEntry } from '@cod/plugin-catalog-import';

/** Forbidden: application/ reaches catalog-import through its own ports (D2200). */
export const importInApplication = catalogImportEntry;
