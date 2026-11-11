import { badEntry } from '@cod/plugin-bad';

/** Forbidden: application/ reaching its own plugin's entry point through the package name. */
export const applicationUsesOwnEntry = badEntry;
