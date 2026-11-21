import { catalogPacksEntry } from '@cod/plugin-catalog-packs';

/** Forbidden: api/ goes through its own application ports, never the catalog-packs entry (D2200). */
export const packsInApi = catalogPacksEntry;
