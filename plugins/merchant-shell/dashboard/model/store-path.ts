import type { SwitchableStoreView } from './types';

/** The store segment that means "the store the session is on" (D82). */
export const ACTIVE_STORE_ALIAS = 'active';

/** The first segment of every store-scoped URL. */
const STORES_SEGMENT = 'stores';

/** `/stores/<store>/<rest>`: group 1 is the store, group 2 the rest including its leading slash. */
const STORE_URL = new RegExp(`^/${STORES_SEGMENT}/([^/]+)(/.*)?$`);

/** The URL of a store-scoped leaf `path` (written without a leading slash) for the store `alias`. */
export function storePathFor(path: string, alias: string): string {
  return `/${STORES_SEGMENT}/${alias}/${path}`;
}

/**
 * Rewrites a store URL to the alias, so the store the switcher moved to keeps the same page (`/stores/123/products`
 * becomes `/stores/active/products`). Returns null for a path that is not a store URL.
 */
export function rewriteToActiveStore(pathname: string): string | null {
  const match = STORE_URL.exec(pathname);
  if (!match) {
    return null;
  }
  return `/${STORES_SEGMENT}/${ACTIVE_STORE_ALIAS}${match[2] ?? ''}`;
}

/** How a `$storeId` URL parameter relates to the session. */
export type StoreParamResolution =
  | { readonly kind: 'current'; readonly id?: string }
  | { readonly kind: 'switch'; readonly id: string }
  | { readonly kind: 'not-found' };

/**
 * Resolves the `$storeId` of `/stores/$storeId/…`. `active` and the active store's own id are the current store; the id
 * of another store in `stores` (the caller's `switchableStores`) asks for a switch; any other id, which includes a
 * store of another business and an archived one, is not found. `activeId` is a store id, not a channel id.
 */
export function resolveStoreParam(
  param: string,
  activeId: string | undefined,
  stores: readonly SwitchableStoreView[],
): StoreParamResolution {
  if (param === ACTIVE_STORE_ALIAS || (activeId !== undefined && param === activeId)) {
    return activeId === undefined ? { kind: 'current' } : { kind: 'current', id: activeId };
  }
  return stores.some((store) => store.id === param) ? { kind: 'switch', id: param } : { kind: 'not-found' };
}
