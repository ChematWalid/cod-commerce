import { skipToken } from '@tanstack/react-query';
import { LS_KEY_SELECTED_CHANNEL_TOKEN } from '@vendure/dashboard';
import { fetchForStore, retriesStoreSwitch } from './store-fetch';
import { placeholderWithinStore } from './store-placeholder';

/**
 * The store a query answers for: its id goes in the key, its channel token is what the answer must be fetched with.
 * A store switch refetches the mounted queries with the new token while they are still keyed by the old store, so an
 * answer fetched with another token is dropped ({@link fetchForStore}) instead of cached under this store.
 */
export interface StoreScope {
  readonly storeId: string;
  readonly channelToken: string;
}

/** The channel token requests are sent with, or null when the browser's storage cannot be read or holds none. */
export function readRequestToken(): string | null {
  try {
    return localStorage.getItem(LS_KEY_SELECTED_CHANNEL_TOKEN);
  } catch (error: unknown) {
    console.error('Could not read the selected channel token', error);
    return null;
  }
}

/**
 * A query of `scope`'s store, keyed by it and waiting while the store is unknown. While a new key loads it shows the
 * previous answer only if that answer is of the same store ({@link placeholderWithinStore}). Only a dropped answer of
 * a switched store is retried ({@link retriesStoreSwitch}).
 */
export function storeQuery<T>(
  prefix: readonly string[],
  scope: StoreScope | null,
  fetchAnswer: () => Promise<T>,
  extra = {},
) {
  return {
    queryKey: [...prefix, scope?.storeId ?? null, extra],
    queryFn: scope === null ? skipToken : () => fetchForStore(scope.channelToken, readRequestToken, fetchAnswer),
    placeholderData: placeholderWithinStore(prefix.length, scope?.storeId ?? null)<T>,
    retry: retriesStoreSwitch,
  } as const;
}
