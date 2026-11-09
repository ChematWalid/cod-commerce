import type { StoreId } from '@cod/shared';
import { StoreArchivedError, StoreNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TenantStoresPort } from '../domain/ports/tenant-stores.port';
import type { Store, StoreActor } from '../domain/store';

/** Whether `actor` holds its permission on the store's channel, not just on the channel of the request. */
export const canReach = (actor: StoreActor, store: Store): boolean => actor.channelIds.includes(store.channelId);

/**
 * The store, whatever its status.
 *
 * @throws {@link StoreNotFoundError} when `actor` cannot reach it, so foreign stores are indistinguishable from none
 */
export async function requireStore(
  stores: TenantStoresPort,
  ctx: OperationContext,
  actor: StoreActor,
  id: StoreId,
): Promise<Store> {
  const store = await stores.find(ctx, actor.businessId, id);
  if (store === undefined || !canReach(actor, store)) {
    throw new StoreNotFoundError();
  }
  return store;
}

/**
 * The store, if it can still change.
 *
 * @throws what {@link requireStore} throws, or {@link StoreArchivedError}
 */
export async function requireActiveStore(
  stores: TenantStoresPort,
  ctx: OperationContext,
  actor: StoreActor,
  id: StoreId,
): Promise<Store> {
  const store = await requireStore(stores, ctx, actor, id);
  if (store.status === 'archived') {
    throw new StoreArchivedError();
  }
  return store;
}
