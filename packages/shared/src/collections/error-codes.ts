/** Stable error codes of the collections API; clients map them to translated messages. */
export const COLLECTIONS_ERROR_CODES = {
  NOT_FOUND: 'collections.not-found',
  INVALID_INPUT: 'collections.invalid-input',
  RULE_INVALID: 'collections.rule-invalid',
  SLUG_TAKEN: 'collections.slug-taken',
  IMAGE_NOT_FOUND: 'collections.image-not-found',
  PRODUCT_NOT_FOUND: 'collections.product-not-found',
  TOO_MANY_PRODUCTS: 'collections.too-many-products',
  TOO_MANY_COLLECTIONS: 'collections.too-many-collections',
  NOT_MANUAL: 'collections.not-manual',
  RATE_LIMITED: 'collections.rate-limited',
} as const;

/** One of the {@link COLLECTIONS_ERROR_CODES} values. */
export type CollectionsErrorCode = (typeof COLLECTIONS_ERROR_CODES)[keyof typeof COLLECTIONS_ERROR_CODES];
