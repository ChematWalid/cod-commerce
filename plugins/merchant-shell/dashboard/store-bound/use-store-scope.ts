import { useAuth } from '@vendure/dashboard';
import type { SwitchableStoreView } from '../model/types';
import type { StoreScope } from './store-query';

/** The store a page's queries answer for, once the session holds its channel token. */
export function useStoreScope(store: SwitchableStoreView | undefined): StoreScope | null {
  const { channels } = useAuth();
  if (store === undefined) return null;
  const channelToken = channels?.find((channel) => channel.id === store.channelId)?.token;
  return channelToken === undefined ? null : { storeId: store.id, channelToken };
}
