import type { ID } from '@vendure/core';
import { hiddenInDashboard } from './routes/hidden.resolver';

/** Forbidden twice: the file an entry point may re-export stays free of frameworks and of the rest of dashboard/. */
export const BAD_PATH = '/bad';
export type LeakedId = ID;
export const leakedThroughConstants = hiddenInDashboard;
