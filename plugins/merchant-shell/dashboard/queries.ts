import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { SWITCHABLE_STORES_QUERY_KEY } from './constants';
import type { SwitchableStoreView } from './model/types';

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
