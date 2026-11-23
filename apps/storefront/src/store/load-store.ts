import { storefrontApiPath, type StorefrontStore, storefrontStoreSchema, storeTag } from '@cod/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { internalFetch } from '../lib/internal-api';
import { StoreResolverError } from '../tenancy/api-store-resolver';

const NOT_FOUND = 404;

/**
 * The active store `storeId`, as `GET /store/by-id/:id` returns it, or `null` when there is none. Cached in the
 * shared cache for hours and tagged with the store, so a `store.changed` revalidation (rename, language, logo)
 * replaces it at once (ADR 0006, D3204). Only the tenant verifier calls it: pages get the store from their
 * `VerifiedTenant`.
 *
 * @throws StoreResolverError when the api answers anything but the store or a 404, or an unexpected shape
 */
export async function loadStore(storeId: string): Promise<StorefrontStore | null> {
  'use cache';
  cacheTag(storeTag(storeId));
  cacheLife('hours');
  const response = await internalFetch(storefrontApiPath('byId', storeId));
  if (response.status === NOT_FOUND) return null;
  if (!response.ok) throw new StoreResolverError(`GET /store/by-id answered ${String(response.status)}`);
  const parsed = storefrontStoreSchema.safeParse(await response.json());
  if (!parsed.success) throw new StoreResolverError(`store ${storeId} came back in an unexpected shape`);
  return parsed.data;
}
