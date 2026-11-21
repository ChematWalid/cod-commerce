import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { RULE_LABEL_IDS } from '../model/condition-fields';

/**
 * Ids the scan cannot see (D89): the server's collections error codes, shown as messages of the same id, and the rule
 * builder's field and operator labels, built from `RULE_FIELDS` and `RULE_OPERATORS_BY_FIELD`.
 */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [...Object.values(COLLECTIONS_ERROR_CODES), ...RULE_LABEL_IDS];
