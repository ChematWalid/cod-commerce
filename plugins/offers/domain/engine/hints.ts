import type { Nudge, Suggestion } from '@cod/shared';
import type { RunningLine } from '../cart';
import { compareOfferIds } from './combine';
import type { DeliveryContext } from './outcome';
import { kindInputOf, type OfferEntry } from './pricing-state';

/** Fewest units first, then the largest saving, then the offer id (D2416). */
const byNudgeRank = (left: Nudge, right: Nudge): number =>
  left.units - right.units || right.saving - left.saving || compareOfferIds(left.offerId, right.offerId);

/**
 * The one nudge of the quote among the eligible offers whose kind nudges (quantity tiers, D2416), measured on the
 * lines before offers; `null` when none has a next tier.
 */
export function nudgeOf(
  entries: readonly OfferEntry[],
  lines: readonly RunningLine[],
  delivery: DeliveryContext,
): Nudge | null {
  const nudges = entries.flatMap((entry) => {
    const nudge = entry.calculator.nudge?.(kindInputOf(entry, lines, delivery)) ?? null;
    return nudge === null ? [] : [nudge];
  });
  return [...nudges].sort(byNudgeRank)[0] ?? null;
}

/** What `suggestionsOf` reads. */
export interface SuggestionsInput {
  readonly entries: readonly OfferEntry[];
  readonly lines: readonly RunningLine[];
  readonly delivery: DeliveryContext;
  readonly waived: boolean;
}

/** Suggestions a waived delivery makes moot: nothing is left to waive (D2416). */
const MOOT_ONCE_WAIVED: ReadonlySet<Suggestion['type']> = new Set<Suggestion['type']>(['free_delivery']);

/**
 * Hints of the eligible offers whose kind suggests, measured on the lines after line offers (D2412): unmet free
 * delivery thresholds (D2416), none once delivery is already waived, and gifts earned but not in the cart (D2504).
 */
export function suggestionsOf({ entries, lines, delivery, waived }: SuggestionsInput): Suggestion[] {
  return entries.flatMap((entry) => {
    const suggestion = entry.calculator.suggest?.(kindInputOf(entry, lines, delivery)) ?? null;
    if (suggestion === null || (waived && MOOT_ONCE_WAIVED.has(suggestion.type))) return [];
    return [suggestion];
  });
}
