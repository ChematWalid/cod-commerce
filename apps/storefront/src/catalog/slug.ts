/**
 * A product or collection slug as the storefront accepts it from a path: lowercase letters, digits and dashes,
 * 1-128 characters, never a `.`, `%` or `/`. Checked before a slug reaches a cache key or an api path.
 */
export const STOREFRONT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;

/** Whether `value` is a slug the storefront may ask the api for. */
export function isStorefrontSlug(value: string): boolean {
  return STOREFRONT_SLUG_PATTERN.test(value);
}
