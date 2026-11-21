import type { MediaReach } from '../domain/ports/media-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { OrderManagerCheckSource } from '../domain/ports/order-manager-check.port';
import type { StoreScope } from '../domain/store-scope';

/**
 * The stores whose media the caller may see, attach and delete (D2132): every store for a caller whose store access
 * is `all` (the owner included), its own stores for a store-restricted member, and the active store alone while no
 * team check is registered to say which.
 */
export async function mediaReachOf(
  source: OrderManagerCheckSource,
  ctx: OperationContext,
  scope: StoreScope,
): Promise<MediaReach> {
  const check = source.current();
  if (check === undefined) return [scope.storeId];
  const access = await check.accessibleStoreIds(ctx, scope.businessId);
  return access === 'all' ? 'all' : [...access];
}
