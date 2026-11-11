import { badEntry } from '@cod/plugin-bad';

/** Forbidden: domain/ reaching its own plugin's entry point through the package name. */
export const domainUsesOwnEntry = badEntry;
