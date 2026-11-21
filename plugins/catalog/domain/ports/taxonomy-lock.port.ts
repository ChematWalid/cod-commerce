import type { Snowflake, TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/**
 * Keeps a product save and the delete of a brand, tag or highlight it names apart. The references have no foreign key,
 * so without it a save could check an entry, the delete could commit, and the save could then commit a dangling id.
 * Both locks last until the transaction of `ctx` ends; a save takes them before its product lock, a delete before
 * anything else, so the two orders never cross. The locks are keyed by `scope`'s business, so a caller naming another
 * business's id never holds that business's lock; a save and a delete of the same entry always share it.
 */
export interface TaxonomyLockPort {
  /** Taken by a product save for every brand, tag and highlight id it names; saves never wait on each other. */
  share(ctx: OperationContext, scope: TenantScope, ids: readonly Snowflake[]): Promise<void>;

  /** Taken by the delete of `id`: waits for every save naming it, and every later save waits for the delete. */
  exclusive(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<void>;
}
