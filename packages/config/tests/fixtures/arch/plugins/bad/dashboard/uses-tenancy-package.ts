import { tenancyEntry } from '@cod/plugin-tenancy';

/** Forbidden: a dashboard importing a server entry point (D92, ADR 0017). */
export const dashboardUsesTenancy = tenancyEntry;
