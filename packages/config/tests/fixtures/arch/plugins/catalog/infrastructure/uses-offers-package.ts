import { offersEntry } from '@cod/plugin-offers';

/** Forbidden: offers depend on the catalog, never the other way round, even from an adapter (D2402). */
export const offersInCatalog = offersEntry;
