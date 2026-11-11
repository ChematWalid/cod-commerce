import { tenancyEntry } from '../../tenancy/index';

/** Forbidden: a dashboard importing a server entry point by path (D92, ADR 0017). */
export const dashboardUsesTenancyByPath = tenancyEntry;
