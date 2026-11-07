import type { Injector, RequestContext } from '@vendure/core';

/** What a seed run changed, one `kind:name` entry per row written. Empty when the database already matched. */
export interface SeedReport {
  changes: string[];
}

/** One idempotent seed step: it reads first and writes only on a difference, returning what it changed. */
export type EnsureStep = (ctx: RequestContext, injector: Injector) => Promise<string[]>;
