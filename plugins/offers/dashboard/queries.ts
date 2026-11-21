import { skipToken, useQuery } from '@tanstack/react-query';
import { api, LS_KEY_SELECTED_CHANNEL_TOKEN } from '@vendure/dashboard';
import { APP_TYPES_QUERY_KEY, EFFECTIVE_PERMISSIONS_QUERY_KEY, OFFERS_QUERY_KEY } from './constants';
import type { OfferAppTypeDto, OfferListInput, OfferPageDto } from './dto';
import { fetchForStore, retriesStoreSwitch } from './model/store-bound-fetch';
import { placeholderWithinStore } from './model/store-placeholder';

const OFFERS_QUERY = /* GraphQL */ `
  query OfferList($options: OfferListInput) {
    offers(options: $options) {
      items {
        id
        kind
        method
        title
        status
        startsAt
        endsAt
        codeCount
        allowedMoves
        deletable
        performance {
          orders
          deliveredRevenue
          discountGiven
        }
      }
      totalItems
    }
  }
`;

const APP_TYPES_QUERY = 'query OfferAppTypes { offerAppTypes { id kind method goal recommended } }';
const EFFECTIVE_PERMISSIONS_QUERY = 'query OfferEffectivePermissions { effectivePermissions { permissions } }';

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

/** One page of the active store's offers under the tab and kind of `options`, newest first (D2513). */
export function useOffers(scope: StoreScope | null, options: OfferListInput) {
  return useQuery(
    storeQuery(
      OFFERS_QUERY_KEY,
      scope,
      async () => (await api.query<{ readonly offers: OfferPageDto }>(OFFERS_QUERY, { options })).offers,
      options,
    ),
  );
}

/** The create dialog's cards and the list's kind chips (D2515). */
export function useOfferAppTypes(scope: StoreScope | null) {
  return useQuery(
    storeQuery(
      APP_TYPES_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly offerAppTypes: readonly OfferAppTypeDto[] }>(APP_TYPES_QUERY)).offerAppTypes,
    ),
  );
}

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
