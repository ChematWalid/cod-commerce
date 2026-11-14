import type { CombinationClass, CombinesWith } from '@cod/shared';

/** What combination reads of a candidate: its offer's rules, its class and its value to the buyer (D2411). */
export interface CombinationCandidate {
  readonly offer: { readonly id: string; readonly combinesWith: CombinesWith };
  readonly combinationClass: CombinationClass;
  readonly value: number;
}

/** The candidates that apply and the ones that lost to a better one they do not combine with. */
export interface Combination<C> {
  readonly accepted: readonly C[];
  readonly rejected: readonly C[];
}

/** Orders decimal id strings by number without parsing: snowflake ids exceed 2^53 (D2421). */
export function compareOfferIds(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Whether `left` and `right` may apply together: each allows the other's class. */
const allowEachOther = (left: CombinationCandidate, right: CombinationCandidate): boolean =>
  left.offer.combinesWith[right.combinationClass] && right.offer.combinesWith[left.combinationClass];

/**
 * Accepts candidates greedily by value, highest first, then by offer id (D2411): one is accepted only if it and every
 * candidate accepted before allow each other; the others are rejected (`not_combinable`).
 */
export function combine<C extends CombinationCandidate>(candidates: readonly C[]): Combination<C> {
  const ranked = [...candidates].sort(
    (left, right) => right.value - left.value || compareOfferIds(left.offer.id, right.offer.id),
  );
  const accepted: C[] = [];
  const rejected: C[] = [];
  for (const candidate of ranked) {
    const fits = accepted.every((other) => allowEachOther(other, candidate));
    (fits ? accepted : rejected).push(candidate);
  }
  return { accepted, rejected };
}
