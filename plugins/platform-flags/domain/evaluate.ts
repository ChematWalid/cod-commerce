import { rolloutBucket } from './rollout';
import { ROLLOUT_MAX_PERCENT } from './constants';
import type { FlagSnapshot, FlagState, FlagSubject, OverrideScope } from './snapshot';

const overrideFor = (flag: FlagState, scope: OverrideScope, scopeId: string | undefined): boolean | undefined =>
  scopeId === undefined
    ? undefined
    : flag.overrides.find((candidate) => candidate.scope === scope && candidate.scopeId === scopeId)?.enabled;

/**
 * Whether `key` is on for `subject` (D116). The most specific override wins: store, then business, then the
 * business's plan (`planKey`, which a caller that has no plan leaves undefined, so plan overrides then match nothing),
 * then the default. The default with a business is `defaultEnabled` and the business's rollout bucket below the
 * percent; without a business only a rollout of 100 % is on. A key the snapshot does not hold is off.
 */
export function evaluateFlag(
  snapshot: FlagSnapshot,
  key: string,
  subject: FlagSubject,
  planKey: string | undefined,
): boolean {
  const flag = snapshot.flags[key];
  if (flag === undefined) return false;
  const { businessId, storeId } = subject;
  const override =
    overrideFor(flag, 'store', storeId) ??
    overrideFor(flag, 'business', businessId) ??
    (businessId === undefined ? undefined : overrideFor(flag, 'plan', planKey));
  if (override !== undefined) return override;
  if (!flag.defaultEnabled) return false;
  if (businessId === undefined) return flag.rolloutPercent >= ROLLOUT_MAX_PERCENT;
  return rolloutBucket(key, businessId) < flag.rolloutPercent;
}
