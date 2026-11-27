import {
  STOREFRONT_LIST_DEFAULT_TAKE,
  STOREFRONT_SEARCH_MAX_QUERY,
  STOREFRONT_SORTS,
  type StorefrontSort,
} from '@cod/shared';

/** The deepest listing page served; a deeper one reads as the first, so a crawler cannot fill the cache. */
export const MAX_LISTING_PAGE = 100;

/** A page's query values as Next hands them over: a key may repeat. */
export type RawQuery = Readonly<Record<string, string | readonly string[] | undefined>>;

/** A listing page request, validated: only these values ever enter a cache key. */
export interface ListingQuery {
  readonly page: number;
  readonly sort: StorefrontSort;
}

/** A search request, validated; search results are never cached (D3214). */
export interface SearchQuery {
  readonly q: string;
  readonly page: number;
}

const PAGE_FORMAT = /^[1-9][0-9]{0,5}$/;

function firstValue(raw: RawQuery, key: string): string {
  const value = raw[key];
  if (typeof value === 'string') return value;
  return value?.[0] ?? '';
}

function pageOf(raw: RawQuery): number {
  const value = firstValue(raw, 'page');
  if (!PAGE_FORMAT.test(value)) return 1;
  const page = Number(value);
  return page <= MAX_LISTING_PAGE ? page : 1;
}

function sortOf(raw: RawQuery): StorefrontSort {
  const value = firstValue(raw, 'sort');
  return STOREFRONT_SORTS.find((sort) => sort === value) ?? STOREFRONT_SORTS[0];
}

/** The listing request of `raw`: an unknown sort is the default one, a bad or too deep page the first. */
export function listingQueryOf(raw: RawQuery): ListingQuery {
  return { page: pageOf(raw), sort: sortOf(raw) };
}

/** The search request of `raw`: the query trimmed and cut to what the api reads. */
export function searchQueryOf(raw: RawQuery): SearchQuery {
  return { q: firstValue(raw, 'q').trim().slice(0, STOREFRONT_SEARCH_MAX_QUERY), page: pageOf(raw) };
}

/** The `skip`, `take` and `sort` of a listing page, as the api's product list reads them. */
export function listingApiQuery(query: ListingQuery): string {
  const skip = (query.page - 1) * STOREFRONT_LIST_DEFAULT_TAKE;
  return new URLSearchParams({
    skip: String(skip),
    take: String(STOREFRONT_LIST_DEFAULT_TAKE),
    sort: query.sort,
  }).toString();
}
