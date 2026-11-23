import {
  STOREFRONT_LIST_DEFAULT_TAKE,
  STOREFRONT_LIST_MAX_TAKE,
  STOREFRONT_SORTS,
  type StorefrontSort,
} from '@cod/shared';

/** A page of a storefront list as the client sent it: every field raw, any may be missing. */
export interface RawListingQuery {
  readonly skip?: unknown;
  readonly take?: unknown;
  readonly sort?: unknown;
}

/** A page of a storefront list, within bounds. */
export interface ListingQuery {
  readonly skip: number;
  readonly take: number;
  readonly sort: StorefrontSort;
}

/** Largest `skip` read: past it a page is empty anyway, and Postgres never sees an overflowing offset. */
export const LISTING_MAX_SKIP = 1_000_000;

const DECIMAL_INTEGER = /^-?\d{1,12}$/;

/** `raw` as an integer when it is a decimal integer (a number or its text), else `undefined`. */
function integerOf(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) ? raw : undefined;
  if (typeof raw !== 'string' || !DECIMAL_INTEGER.test(raw.trim())) return undefined;
  return Number(raw.trim());
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const isSort = (raw: unknown): raw is StorefrontSort => (STOREFRONT_SORTS as readonly unknown[]).includes(raw);

/**
 * The bounded page of a raw list query: `take` clamped to 1..{@link STOREFRONT_LIST_MAX_TAKE} (default
 * {@link STOREFRONT_LIST_DEFAULT_TAKE}), `skip` to 0..{@link LISTING_MAX_SKIP}, and an unknown sort read as the
 * first, `newest`. Malformed input is never an error: a storefront URL a buyer edits still shows a page.
 */
export function listingQueryOf(raw: RawListingQuery): ListingQuery {
  const take = integerOf(raw.take);
  const skip = integerOf(raw.skip);
  return {
    skip: skip === undefined ? 0 : clamp(skip, 0, LISTING_MAX_SKIP),
    take: take === undefined ? STOREFRONT_LIST_DEFAULT_TAKE : clamp(take, 1, STOREFRONT_LIST_MAX_TAKE),
    sort: isSort(raw.sort) ? raw.sort : STOREFRONT_SORTS[0],
  };
}
