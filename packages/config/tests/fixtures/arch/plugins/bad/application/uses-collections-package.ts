import { collectionsEntry } from '@cod/plugin-collections-rules';

/** Forbidden: application/ declares ports, it never imports the collections entry (D2317). */
export const collectionsInApplication = collectionsEntry;
