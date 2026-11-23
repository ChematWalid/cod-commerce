import { SLUG_MAX } from '@cod/shared';

/**
 * A product or collection slug as the storefront accepts it from a path: lowercase or caseless letters of any language
 * (the catalog keeps a title's Arabic letters in the slug it derives, D2103), combining marks after the first
 * character, digits, `-` and `_`, 1 to `SLUG_MAX` characters; never a `.`, `%`, `/`, space, upper-case letter or format
 * character such as a bidi override. Checked before a slug reaches a cache key or an api path.
 */
export const STOREFRONT_SLUG_PATTERN = new RegExp(
  `^[\\p{Ll}\\p{Lo}\\p{Lm}\\p{Nd}][\\p{Ll}\\p{Lo}\\p{Lm}\\p{M}\\p{Nd}_-]{0,${String(SLUG_MAX - 1)}}$`,
  'u',
);

/** Whether `value` is a slug the storefront may ask the api for. */
export function isStorefrontSlug(value: string): boolean {
  return STOREFRONT_SLUG_PATTERN.test(value);
}
