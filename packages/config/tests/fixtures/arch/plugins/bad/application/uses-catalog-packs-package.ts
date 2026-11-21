import { catalogPacksEntry } from '@cod/plugin-catalog-packs';

/** Forbidden: application/ declares ports, it never imports the catalog-packs entry (D2200). */
export const packsInApplication = catalogPacksEntry;
