import type { CombinationClass, CombinesWith } from '@cod/shared';
import { ACCEPTED_LIMIT_PER_LINE_BY_CLASS, ACCEPTED_LIMIT_PER_QUOTE_BY_CLASS } from '../constants';

/**
 * What combination reads of a candidate: its offer's rules, its class, its value to the buyer and the keys of the
 * lines it discounts (empty for order and delivery offers) (D2411).
 */
export interface CombinationCandidate {
  readonly offer: { readonly id: string; readonly combinesWith: CombinesWith };
  readonly combinationClass: CombinationClass;
  readonly value: number;
  readonly lineKeys: readonly string[];
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

/** Whether `accepted` still has room in the quote for one more candidate of the candidate's class. */
function quoteHasRoomFor(accepted: readonly CombinationCandidate[], candidate: CombinationCandidate): boolean {
  const limit = ACCEPTED_LIMIT_PER_QUOTE_BY_CLASS[candidate.combinationClass];
  if (limit === undefined) return true;
  return accepted.filter((other) => other.combinationClass === candidate.combinationClass).length < limit;
}

/** Whether every line the candidate discounts still has room for one more candidate of its class. */
function linesHaveRoomFor(accepted: readonly CombinationCandidate[], candidate: CombinationCandidate): boolean {
  const limit = ACCEPTED_LIMIT_PER_LINE_BY_CLASS[candidate.combinationClass];
  if (limit === undefined) return true;
  const sameClass = accepted.filter((other) => other.combinationClass === candidate.combinationClass);
  return candidate.lineKeys.every((key) => sameClass.filter((other) => other.lineKeys.includes(key)).length < limit);
}

/**
 * Accepts candidates greedily by value, highest first, then by offer id (D2411): one is accepted only if it and every
 * candidate accepted before allow each other, its class is not full in the quote (`ACCEPTED_LIMIT_PER_QUOTE_BY_CLASS`)
 * and no line it discounts is full (`ACCEPTED_LIMIT_PER_LINE_BY_CLASS`): both bound the signed token. The others are
 * rejected (`not_combinable`).
 */
export function combine<C extends CombinationCandidate>(candidates: readonly C[]): Combination<C> {
  const ranked = [...candidates].sort(
    (left, right) => right.value - left.value || compareOfferIds(left.offer.id, right.offer.id),
  );
  const accepted: C[] = [];
  const rejected: C[] = [];
  for (const candidate of ranked) {
    const fits =
      quoteHasRoomFor(accepted, candidate) &&
      linesHaveRoomFor(accepted, candidate) &&
      accepted.every((other) => allowEachOther(other, candidate));
    (fits ? accepted : rejected).push(candidate);
  }
  return { accepted, rejected };
}
