import { OFFER_TARGET_ROLES, TARGET_REF_TYPES } from '@cod/shared';

/** Offers, targets and codes are store-owned (D2405): the check that stands in for `storeId NOT NULL`. */
export const STORE_REQUIRED_CHECK = '"storeId" IS NOT NULL';

const sqlList = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');

/** Target columns hold only values the engine knows (Task 10 Step 1c); the repository still drops any other. */
export const TARGET_REF_TYPE_CHECK = `"refType" IN (${sqlList(TARGET_REF_TYPES)})`;
export const TARGET_ROLE_CHECK = `"role" IN (${sqlList(OFFER_TARGET_ROLES)})`;
