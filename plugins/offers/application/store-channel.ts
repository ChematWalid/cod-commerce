import { NoActiveStoreError } from '../domain/errors';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';

/**
 * Refuses a call whose `ctx` is not on `scope`'s store channel, or whose store is not `scope`'s business's (D2408,
 * D2448): a use case that takes its scope from the caller never reads or writes another store's rows on a mismatch.
 *
 * @throws {@link NoActiveStoreError} on a mismatch.
 */
export async function assertOnChannelOf(
  stores: ActiveStorePort,
  ctx: OperationContext,
  scope: StoreScope,
): Promise<void> {
  if (!(await stores.isChannelOf(ctx, scope))) throw new NoActiveStoreError();
}
