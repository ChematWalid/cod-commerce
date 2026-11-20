import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { EFFECTIVE_PERMISSIONS_QUERY_KEY } from '../constants';
import { type StoreScope, storeQuery } from '../model/store-query';

const EFFECTIVE_PERMISSIONS_QUERY = 'query CollectionsEffectivePermissions { effectivePermissions { permissions } }';

/**
 * What the server says the caller holds on the active store; empty until it answers for this store, so nothing shows
 * on a guess, not even a kept answer of an earlier key.
 */
export function useHeldPermissions(scope: StoreScope | null): ReadonlySet<string> {
  const { data, isSuccess, isPlaceholderData } = useQuery(
    storeQuery(EFFECTIVE_PERMISSIONS_QUERY_KEY, scope, () =>
      api.query<{ readonly effectivePermissions: { readonly permissions: readonly string[] } }>(
        EFFECTIVE_PERMISSIONS_QUERY,
      ),
    ),
  );
  return new Set(isSuccess && !isPlaceholderData ? data.effectivePermissions.permissions : []);
}
