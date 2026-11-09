import type { OperationContext } from './operation-context';

/** Ends Vendure sessions one at a time; Vendure's own service can only end all of a user's (D22). */
export interface SessionTerminatorPort {
  /** Ends the caller's session. `false` when there is none that can be ended (none at all, or an API key). */
  endCurrent(ctx: OperationContext): Promise<boolean>;

  /**
   * Deletes the rows of the user's other sessions inside `ctx`'s transaction and returns their tokens, which
   * the caller passes to {@link flushCache} after the commit.
   */
  endOthers(ctx: OperationContext, userId: string, keepToken: string): Promise<string[]>;

  /** Evicts tokens from the session cache, so they stop working now and not after the cache TTL. */
  flushCache(tokens: readonly string[]): Promise<void>;
}
