import { SLUG_MAX } from '@cod/shared';
import { normalizeString } from '@vendure/common/lib/normalize-string';

/** Slugs are written as Vendure's slug validator writes them: lower case, NFD, dashes. */
const SLUG_SPACE = '-';
/** The slug of a collection whose title has no letter or digit Vendure keeps. */
const FALLBACK_SLUG = 'collection';

/**
 * `raw` as Vendure stores a collection slug (NFD, so an Arabic NFC and NFD slug are one slug, D2319), cut to the
 * column and never empty.
 */
export function storedSlug(raw: string): string {
  const slug = normalizeString(raw, SLUG_SPACE).slice(0, SLUG_MAX);
  return slug === '' ? FALLBACK_SLUG : slug;
}
