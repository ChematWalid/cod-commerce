import { STOREFRONT_SEARCH_MAX_QUERY, STOREFRONT_SORTS } from '@cod/shared';
import { isStorefrontSlug } from '../catalog/slug';

/** The query param a client could use to name another store; it must match the store of the host. */
export const STORE_ID_PARAM = 'storeId';

/** At most six digits: the api clamps `take` and pages past the result answer empty pages. */
const COUNT_FORMAT = /^[0-9]{1,6}$/;

/** The only query params forwarded upstream, each with its check; anything else is dropped. */
const FORWARDED_PARAMS: Readonly<Record<string, (value: string) => string | null>> = {
  skip: (value) => (COUNT_FORMAT.test(value) ? value : null),
  take: (value) => (COUNT_FORMAT.test(value) ? value : null),
  sort: (value) => (STOREFRONT_SORTS.some((sort) => sort === value) ? value : null),
  q: (value) => {
    const query = value.trim().slice(0, STOREFRONT_SEARCH_MAX_QUERY);
    return query === '' ? null : query;
  },
  collection: (value) => (isStorefrontSlug(value) ? value : null),
};

/** What the query of a store api call becomes. */
export type ForwardedQuery = { readonly ok: true; readonly query: string } | { readonly ok: false };

/**
 * The query to send upstream: the allow-listed params (`skip`, `take`, `sort`, `q`, `collection`), each validated,
 * first value only, invalid ones dropped. A `storeId` that is not the host's store refuses the whole call: the store
 * comes from the host alone.
 */
export function forwardedQueryOf(params: URLSearchParams, storeId: string): ForwardedQuery {
  const claimed = params.get(STORE_ID_PARAM);
  if (claimed !== null && claimed !== storeId) return { ok: false };
  const forwarded = new URLSearchParams();
  for (const [key, check] of Object.entries(FORWARDED_PARAMS)) {
    const value = params.get(key);
    const checked = value === null ? null : check(value);
    if (checked !== null) forwarded.set(key, checked);
  }
  return { ok: true, query: forwarded.toString() };
}
