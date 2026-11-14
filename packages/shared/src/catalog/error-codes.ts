/** Stable error codes of the catalog API; clients map them to translated messages. */
export const CATALOG_ERROR_CODES = {
  PRODUCT_NOT_FOUND: 'catalog.product-not-found',
  INVALID_INPUT: 'catalog.invalid-input',
  TOO_MANY_HIGHLIGHTS: 'catalog.too-many-highlights',
  MATRIX_TOO_LARGE: 'catalog.matrix-too-large',
  DUPLICATE_OPTION_VALUE: 'catalog.duplicate-option-value',
  DUPLICATE_OPTION_NAME: 'catalog.duplicate-option-name',
  BRAND_NOT_FOUND: 'catalog.brand-not-found',
  TAG_NOT_FOUND: 'catalog.tag-not-found',
  HIGHLIGHT_NOT_FOUND: 'catalog.highlight-not-found',
  MEDIA_NOT_FOUND: 'catalog.media-not-found',
  MEDIA_TOO_LARGE: 'catalog.media-too-large',
  MEDIA_TYPE: 'catalog.media-type',
  MEDIA_IN_USE: 'catalog.media-in-use',
  ORDER_MANAGER_UNKNOWN: 'catalog.order-manager-unknown',
  ORDER_MANAGERS_UNAVAILABLE: 'catalog.order-managers-unavailable',
  NAME_TAKEN: 'catalog.name-taken',
} as const;

/** One of the {@link CATALOG_ERROR_CODES} values. */
export type CatalogErrorCode = (typeof CATALOG_ERROR_CODES)[keyof typeof CATALOG_ERROR_CODES];

/** Codes of the warnings a save returns without refusing it (brief AC3: old price below price warns, never blocks). */
export const CATALOG_WARNING_CODES = {
  oldPriceBelowPrice: 'catalog.old-price-below-price',
} as const;

/** One of the {@link CATALOG_WARNING_CODES} values. */
export type CatalogWarningCode = (typeof CATALOG_WARNING_CODES)[keyof typeof CATALOG_WARNING_CODES];
