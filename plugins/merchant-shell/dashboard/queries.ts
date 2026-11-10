import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { ACTIVE_BUSINESS_QUERY_KEY, STORE_RECORD_QUERY_KEY, SWITCHABLE_STORES_QUERY_KEY } from './constants';
import type { BusinessRecord, StoreRecord, SwitchableStoreView } from './model/types';

const SWITCHABLE_STORES_QUERY = /* GraphQL */ `
  query ShellSwitchableStores {
    switchableStores {
      platformDomain
      stores {
        id
        businessId
        channelId
        name
        subdomain
        language
      }
    }
  }
`;

/** The answer of `switchableStores` (D85). */
export interface SwitchableStoresDto {
  readonly platformDomain: string;
  readonly stores: readonly SwitchableStoreView[];
}

/** The stores the caller can switch to. Keyed by the active channel, so a stale-token failure retries once it moves. */
export function useSwitchableStores(
  activeChannelId: string | undefined,
): ReturnType<typeof useQuery<SwitchableStoresDto>> {
  return useQuery({
    queryKey: [...SWITCHABLE_STORES_QUERY_KEY, activeChannelId],
    queryFn: async () =>
      (await api.query<{ readonly switchableStores: SwitchableStoresDto }>(SWITCHABLE_STORES_QUERY)).switchableStores,
    enabled: activeChannelId !== undefined,
    retry: false,
  });
}

const ACTIVE_BUSINESS_QUERY = /* GraphQL */ `
  query ShellActiveBusiness {
    activeBusiness {
      id
      name
    }
  }
`;

const STORE_QUERY = /* GraphQL */ `
  query ShellStore($id: String!) {
    store(id: $id) {
      id
      name
      description
      language
    }
  }
`;

/** The caller's business, for whoever holds `settings.business.view` on the active store. */
export function useActiveBusiness(
  activeChannelId: string | undefined,
  enabled: boolean,
): ReturnType<typeof useQuery<BusinessRecord>> {
  return useQuery({
    queryKey: [...ACTIVE_BUSINESS_QUERY_KEY, activeChannelId],
    queryFn: async () =>
      (await api.query<{ readonly activeBusiness: BusinessRecord }>(ACTIVE_BUSINESS_QUERY)).activeBusiness,
    enabled: enabled && activeChannelId !== undefined,
    retry: false,
  });
}

/** One store of the active business, for whoever holds `store.stores.view`. The server answers null for any other. */
export function useStoreRecord(
  activeChannelId: string | undefined,
  storeId: string | undefined,
  enabled: boolean,
): ReturnType<typeof useQuery<StoreRecord | null>> {
  return useQuery({
    queryKey: [...STORE_RECORD_QUERY_KEY, activeChannelId, storeId],
    queryFn: async () => (await api.query<{ readonly store: StoreRecord | null }>(STORE_QUERY, { id: storeId })).store,
    enabled: enabled && activeChannelId !== undefined && storeId !== undefined,
    retry: false,
  });
}
