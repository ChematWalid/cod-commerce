import { rateLimitEntry } from '../../rate-limit/index';

/** Forbidden: application/ reaching the rate-limit entry point. */
export const usesRateLimitEntry = rateLimitEntry;
