import { tenancyEntry } from '@cod/plugin-tenancy';

/** Forbidden: application/ reaching the tenancy entry point through the package name. */
export const usesTenancyPackage = tenancyEntry;
