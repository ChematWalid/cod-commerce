import { CATALOG_IMPORT_ERROR_CODES, CATALOG_IMPORT_ROW_REASONS } from '@cod/shared';

/**
 * Ids the scan cannot see (D89): the server's import error codes and the preview rows' reasons (D2209), shown as
 * messages of the same id.
 */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [
  ...new Set([...Object.values(CATALOG_IMPORT_ERROR_CODES), ...Object.values(CATALOG_IMPORT_ROW_REASONS)]),
];
