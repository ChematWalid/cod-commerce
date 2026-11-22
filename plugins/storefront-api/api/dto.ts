import type { RawListingQuery } from '../domain/listing-query';

/** The query string of a storefront list, as Express parsed it: any field may be absent, an array or an object. */
export type RawQuery = Readonly<Record<string, unknown>>;

/** A slug from a path or query: a string, else nothing a lookup could find. */
export const slugOf = (raw: unknown): string | undefined => (typeof raw === 'string' ? raw : undefined);

/** The page fields of a list query, left raw: the domain clamps them (never a 400, D2136). */
export const listingOf = (query: RawQuery | undefined): RawListingQuery => ({
  skip: query?.['skip'],
  take: query?.['take'],
  sort: query?.['sort'],
});

/**
 * The `collection` filter of a product list: absent → `{}`; one string → its slug; anything else (repeated, nested)
 * → `undefined`, which the API answers as an unknown collection.
 */
export function collectionFilterOf(query: RawQuery | undefined): { collection?: string } | undefined {
  const raw = query?.['collection'];
  if (raw === undefined) return {};
  const slug = slugOf(raw);
  return slug === undefined ? undefined : { collection: slug };
}
