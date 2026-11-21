import { variantRule } from '../../catalog/domain/variant-rule';

/** Forbidden: even an adapter reaches the catalog through its entry only, never its internals (D2104). */
export const leakedRule = variantRule;
