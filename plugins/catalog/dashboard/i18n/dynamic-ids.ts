import { CATALOG_ERROR_CODES, CATALOG_WARNING_CODES } from '@cod/shared';

/** Ids the scan cannot see (D89): the server's catalog error and warning codes, shown as messages of the same id. */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [
  ...Object.values(CATALOG_ERROR_CODES),
  ...Object.values(CATALOG_WARNING_CODES),
];
