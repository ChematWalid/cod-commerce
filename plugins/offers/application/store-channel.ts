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

/**
 * Refuses a call whose `ctx` is not on `scope`'s store channel, or whose store is not `scope`'s business's, but lets an
 * archived store through (D2448): an order taken before its store was archived can still be cancelled, rejected or
 * edited, and its uses must move with it (D2447).
 *
 * @throws {@link NoActiveStoreError} on a mismatch.
 */
export async function assertOnOwnChannelOf(
  stores: ActiveStorePort,
  ctx: OperationContext,
  scope: StoreScope,
): Promise<void> {
  if (!(await stores.isOwnChannelOf(ctx, scope))) throw new NoActiveStoreError();
}
