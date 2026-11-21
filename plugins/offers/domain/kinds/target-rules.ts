import type { TargetRules } from '../engine/kind-registry';

/** Buy targets only, at least one before publish: the offer prices the targeted lines (D2501). */
export const BUY_TARGET_REQUIRED: TargetRules = { allowed: ['buy'], required: ['buy'] };

/** Buy targets allowed (P2.S4 rows keep theirs), none needed: the offer reads the whole cart (D2501). */
export const BUY_TARGET_OPTIONAL: TargetRules = { allowed: ['buy'], required: [] };
