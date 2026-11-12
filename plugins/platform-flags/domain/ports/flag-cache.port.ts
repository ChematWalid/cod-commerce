import type { FlagSnapshot } from '../snapshot';

/**
 * The shared snapshot and its change notice (Valkey). A fault never throws: a read answers `undefined` and a write or
 * an invalidation answers `false`, so the caller falls back to the database.
 */
export interface FlagCachePort {
  read(): Promise<FlagSnapshot | undefined>;
  write(snapshot: FlagSnapshot): Promise<boolean>;
  /** Deletes the shared snapshot and tells every process; false when either step failed. */
  invalidate(): Promise<boolean>;
}
