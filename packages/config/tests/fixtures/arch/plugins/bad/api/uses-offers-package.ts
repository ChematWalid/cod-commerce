import { offersEntry } from '@cod/plugin-offers';

/** Forbidden: api/ goes through its own application ports, never the offers entry (D2402). */
export const offersInApi = offersEntry;
