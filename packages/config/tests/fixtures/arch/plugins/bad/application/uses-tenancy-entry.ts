import { tenancyEntry } from '../../tenancy/index';

/** Forbidden: application/ reaching the tenancy entry point. */
export const usesTenancyEntry = tenancyEntry;
