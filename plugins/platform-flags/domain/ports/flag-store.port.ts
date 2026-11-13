import type { FlagSeed } from '@cod/shared';
import type { FlagSnapshot, FlagState, OverrideScope } from '../snapshot';

/** What staff may change on a flag; absent keys stay as they are. */
export interface FlagPatch {
  readonly defaultEnabled?: boolean;
  readonly rolloutPercent?: number;
  readonly description?: string;
}

/** An override's identity. */
export interface OverrideKey {
  readonly key: string;
  readonly scope: OverrideScope;
  readonly scopeId: string;
}

/** A flag before and after a change, for the audit line. */
export interface FlagChange {
  readonly before: FlagState;
  readonly after: FlagState;
}

/** The two flag tables. Adapters are the only code that touches TypeORM. */
export interface FlagStorePort {
  /** Every flag with its overrides, read from the database. */
  loadSnapshot(): Promise<FlagSnapshot>;
  /** Inserts the seeds that are missing and returns how many it inserted; an existing row is never touched. */
  insertMissing(seeds: readonly FlagSeed[]): Promise<number>;
  /** Applies `patch`; undefined when the flag does not exist. */
  update(key: string, patch: FlagPatch, actor: string): Promise<FlagChange | undefined>;
  /** Creates or replaces the override; undefined when the flag does not exist. */
  setOverride(override: OverrideKey & { readonly enabled: boolean }, actor: string): Promise<FlagChange | undefined>;
  /** Removes the override if there is one; undefined when the flag does not exist. */
  removeOverride(override: OverrideKey, actor: string): Promise<FlagChange | undefined>;
}
