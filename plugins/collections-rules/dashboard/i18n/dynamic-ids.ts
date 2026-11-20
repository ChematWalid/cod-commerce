import { COLLECTIONS_ERROR_CODES } from '@cod/shared';

/** Ids the scan cannot see (D89): the server's collections error codes, shown as messages of the same id. */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = Object.values(COLLECTIONS_ERROR_CODES);
