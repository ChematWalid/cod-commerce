import type { StoreId } from '@cod/shared';

/** Finds the stores that serve buyers, for the signed per-store routes (D3106). */
export interface ServedStores {
  /**
   * The store behind `raw`, when it is a well-formed id of an active store of an active business; `null` for anything
   * else (missing, repeated, malformed, unknown, archived or suspended), which the API answers alike.
   */
  servedStore(raw: unknown): Promise<StoreId | null>;
}
