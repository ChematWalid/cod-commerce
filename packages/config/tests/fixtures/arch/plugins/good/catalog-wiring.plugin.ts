import { catalogEntry } from '@cod/plugin-catalog';

/** Allowed: a Nest module file importing the catalog module class through its public entry (D2104). */
export const imports = [catalogEntry];
