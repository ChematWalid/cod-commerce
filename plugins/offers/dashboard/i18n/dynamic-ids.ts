import { PRICING_ERROR_CODES } from '@cod/shared';

/** Ids the scan cannot see (D89): the server's pricing and offer error codes, shown as messages of the same id. */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [...Object.values(PRICING_ERROR_CODES)];
