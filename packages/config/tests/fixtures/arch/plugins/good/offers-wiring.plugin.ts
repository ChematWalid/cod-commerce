import { offersEntry } from '@cod/plugin-offers';

/** Allowed: a Nest module file importing the offers module class through its public entry (D2402). */
export const imports = [offersEntry];
