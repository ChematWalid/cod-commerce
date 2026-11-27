import { DELIVERY_PRICING_ERROR_CODES, PRICING_CSV_ROW_ISSUES } from '@cod/shared';
import { csvIssueMessageIdOf } from '../model/csv-preview';

/**
 * Ids the scan cannot see (D89): the server's delivery-pricing error codes, shown as messages of the same id, and the
 * reasons a CSV row is refused (D3142).
 */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [
  ...Object.values(DELIVERY_PRICING_ERROR_CODES),
  ...PRICING_CSV_ROW_ISSUES.map(csvIssueMessageIdOf),
];
