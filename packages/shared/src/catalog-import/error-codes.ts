/** Stable error codes of the import, export and bulk-edit API; clients map them to translated messages. */
export const CATALOG_IMPORT_ERROR_CODES = {
  INVALID_INPUT: 'catalog-import.invalid-input',
  JOB_NOT_FOUND: 'catalog-import.job-not-found',
  JOB_STATE: 'catalog-import.job-state',
  FILE_TYPE: 'catalog-import.file-type',
  FILE_TOO_LARGE: 'catalog-import.file-too-large',
  TOO_MANY_ROWS: 'catalog-import.too-many-rows',
  NO_HEADER: 'catalog-import.no-header',
  UPDATE_FORBIDDEN: 'catalog-import.update-forbidden',
  COLLECTIONS_UNAVAILABLE: 'catalog-import.collections-unavailable',
  TAXONOMY_NOT_FOUND: 'catalog-import.taxonomy-not-found',
  ROW_PRODUCT_NOT_FOUND: 'catalog-import.row-product-not-found',
  PRICE_OUT_OF_RANGE: 'catalog-import.price-out-of-range',
  LINK_REFUSED: 'catalog-import.link-refused',
  LINK_UNREACHABLE: 'catalog-import.link-unreachable',
  AI_DISABLED: 'catalog-import.ai-disabled',
} as const;

/** One of the {@link CATALOG_IMPORT_ERROR_CODES} values. */
export type CatalogImportErrorCode = (typeof CATALOG_IMPORT_ERROR_CODES)[keyof typeof CATALOG_IMPORT_ERROR_CODES];

/**
 * Why a preview row is an error (D2209): the row is not applied. A foreign, missing or another store's `id:<n>` all
 * give `row-product-not-found`, so the reason is no oracle.
 */
export const CATALOG_IMPORT_ROW_ERRORS = {
  AMBIGUOUS: 'catalog-import.row-ambiguous',
  DUPLICATE_IN_FILE: 'catalog-import.row-duplicate-in-file',
  INVALID_VALUE: 'catalog-import.row-invalid-value',
  TYPE_UNSUPPORTED: 'catalog-import.row-type-unsupported',
  IMAGE_URL: 'catalog-import.row-image-url',
  PRODUCT_NOT_FOUND: CATALOG_IMPORT_ERROR_CODES.ROW_PRODUCT_NOT_FOUND,
  UPDATE_FORBIDDEN: CATALOG_IMPORT_ERROR_CODES.UPDATE_FORBIDDEN,
} as const;

/** What a preview row warns about: the row is applied, without the field named. */
export const CATALOG_IMPORT_ROW_WARNINGS = {
  UNKNOWN_COLUMN: 'catalog-import.warn-unknown-column',
  UNKNOWN_TAXONOMY: 'catalog-import.warn-unknown-taxonomy',
  COLLECTIONS_IGNORED: 'catalog-import.warn-collections-ignored',
  WEIGHT_CONFLICT: 'catalog-import.warn-weight-conflict',
} as const;

/** Every reason a preview row may carry, error or warning; each is a message id of the import dashboard. */
export const CATALOG_IMPORT_ROW_REASONS = { ...CATALOG_IMPORT_ROW_ERRORS, ...CATALOG_IMPORT_ROW_WARNINGS } as const;

/** One of the {@link CATALOG_IMPORT_ROW_ERRORS} values. */
export type CatalogImportRowError = (typeof CATALOG_IMPORT_ROW_ERRORS)[keyof typeof CATALOG_IMPORT_ROW_ERRORS];
/** One of the {@link CATALOG_IMPORT_ROW_WARNINGS} values. */
export type CatalogImportRowWarning = (typeof CATALOG_IMPORT_ROW_WARNINGS)[keyof typeof CATALOG_IMPORT_ROW_WARNINGS];
/** One of the {@link CATALOG_IMPORT_ROW_REASONS} values. */
export type CatalogImportRowReason = CatalogImportRowError | CatalogImportRowWarning;
