import { rateLimitEntry } from '@cod/plugin-rate-limit';

/** Forbidden: a dashboard importing a server entry point (D92, ADR 0017). */
export const dashboardUsesRateLimit = rateLimitEntry;
