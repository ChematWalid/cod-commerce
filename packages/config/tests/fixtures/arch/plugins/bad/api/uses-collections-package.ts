import { collectionsEntry } from '@cod/plugin-collections-rules';

/** Forbidden: api/ goes through its own application ports, never the collections entry (D2317). */
export const collectionsInApi = collectionsEntry;
