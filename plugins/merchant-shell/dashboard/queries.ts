import { FEE_GROUP_LIST_MAX_TAKE } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  ACTIVE_BUSINESS_QUERY_KEY,
  STORE_FEE_GROUPS_QUERY_KEY,
  STORE_RECORD_QUERY_KEY,
  SWITCHABLE_STORES_QUERY_KEY,
} from './constants';
import { type FeeGroupOption, type FeeGroupOptionPage, readAllFeeGroups } from './model/fee-group-field';
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
      logoAssetId
      logoUrl
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
      logoAssetId
      logoUrl
      showAddressField
      soldOutBehavior
      defaultDeliveryFeeGroupId
    }
  }
`;

const FEE_GROUP_OPTIONS_QUERY = /* GraphQL */ `
  query ShellFeeGroupOptions($options: DeliveryFeeGroupListInput) {
    deliveryFeeGroups(options: $options) {
      items {
        id
        name
      }
      totalItems
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

const fetchFeeGroupPage = async (skip: number, take: number): Promise<FeeGroupOptionPage> =>
  (
    await api.query<{ readonly deliveryFeeGroups: FeeGroupOptionPage }>(FEE_GROUP_OPTIONS_QUERY, {
      options: { skip, take },
    })
  ).deliveryFeeGroups;

/**
 * Every pricing option of the active store, for the Default delivery fee group select (issue 207). Only for whoever
 * holds `delivery.pricing.view`, which the server checks again.
 */
export function useStoreFeeGroups(
  activeChannelId: string | undefined,
  enabled: boolean,
): ReturnType<typeof useQuery<readonly FeeGroupOption[]>> {
  return useQuery({
    queryKey: [...STORE_FEE_GROUPS_QUERY_KEY, activeChannelId],
    queryFn: () => readAllFeeGroups(fetchFeeGroupPage, FEE_GROUP_LIST_MAX_TAKE),
    enabled: enabled && activeChannelId !== undefined,
    retry: false,
  });
}
