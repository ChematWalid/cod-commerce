import { SLUG_MAX } from '@cod/shared';
import { normalizeString } from '@vendure/common/lib/normalize-string';
import { InvalidCatalogInputError } from '../domain/errors';

/** Slugs are written as Vendure's slug validator writes them: lower case, NFD, dashes. */
const SLUG_SPACE = '-';
/** The slug of a product whose title has no letter or digit Vendure keeps. */
const FALLBACK_SLUG = 'product';

/** `raw` as Vendure stores a slug (NFD, so an Arabic NFC and NFD slug are the same slug, D2103). */
export const normalisedSlug = (raw: string): string => normalizeString(raw, SLUG_SPACE);

/**
 * A slug the merchant typed, as stored. NFD can make Arabic text longer (a hamza letter is two code points), so the
 * stored form is checked against the column, never only the typed one.
 *
 * @throws {InvalidCatalogInputError} when the stored slug is empty or longer than `SLUG_MAX`.
 */
export function merchantSlug(raw: string): string {
  const slug = normalisedSlug(raw);
  if (slug === '' || slug.length > SLUG_MAX) throw new InvalidCatalogInputError();
  return slug;
}

/** A slug made from the title when the merchant gave none: cut to the column, never empty. */
export function derivedSlug(title: string): string {
  const slug = normalisedSlug(title).slice(0, SLUG_MAX);
  return slug === '' ? FALLBACK_SLUG : slug;
}
