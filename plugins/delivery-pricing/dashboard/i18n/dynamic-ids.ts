import { DELIVERY_PRICING_ERROR_CODES } from '@cod/shared';

/** Ids the scan cannot see (D89): the server's delivery-pricing error codes, shown as messages of the same id. */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = Object.values(DELIVERY_PRICING_ERROR_CODES);
