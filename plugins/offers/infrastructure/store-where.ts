import { NoActiveStoreError } from '../domain/errors';
import type { StoreScope } from '../domain/store-scope';

/**
 * The store half of a row filter; `TenantRepository` adds the business itself (ADR 0002).
 *
 * @throws {@link NoActiveStoreError} when the scope names no store: offers and codes are store-owned (D2405), and a
 * `storeId` filter of nothing must never widen to the whole business.
 */
export function inStore(scope: StoreScope): { storeId: string } {
  if (!scope.storeId) throw new NoActiveStoreError();
  return { storeId: scope.storeId };
}
