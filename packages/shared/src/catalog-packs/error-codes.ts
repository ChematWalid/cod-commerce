/** Stable error codes of the pack API; clients map them to translated messages. */
export const CATALOG_PACKS_ERROR_CODES = {
  INVALID_INPUT: 'packs.invalid-input',
  NOT_FOUND: 'packs.not-found',
  NOT_A_PACK: 'packs.not-a-pack',
  COMPONENT_NOT_FOUND: 'packs.component-not-found',
  COMPONENT_IS_PACK: 'packs.component-is-pack',
  SHARED_OPTION_MISSING: 'packs.shared-option-missing',
  NO_COMMON_VALUE: 'packs.no-common-value',
} as const;

/** One of the {@link CATALOG_PACKS_ERROR_CODES} values. */
export type CatalogPacksErrorCode = (typeof CATALOG_PACKS_ERROR_CODES)[keyof typeof CATALOG_PACKS_ERROR_CODES];
