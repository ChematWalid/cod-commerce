import type { CodeRejectReason, RejectedCode, SkippedOffer, SkipReason } from '@cod/shared';
import type { OfferOutcome } from './outcome';

/** Offers that matched the cart but did not apply, and codes that gave no discount (D2417). */
export interface Refusals {
  readonly skipped: readonly SkippedOffer[];
  readonly rejectedCodes: readonly RejectedCode[];
}

/** The offer a refusal is about and the code that activated it, if any. */
export interface RefusedEntry {
  readonly offer: { readonly id: string };
  readonly code: string | null;
}

export const NO_REFUSALS: Refusals = { skipped: [], rejectedCodes: [] };

/** How a buyer reads an offer's skip reason when they typed its code (D2417): eligibility rules read as one. */
const CODE_REJECT_BY_SKIP: Readonly<Record<SkipReason, CodeRejectReason>> = {
  no_tier_reached: 'min_not_met',
  not_started: 'not_started',
  ended: 'ended',
  audience: 'not_eligible',
  channel: 'not_eligible',
  wilaya: 'not_eligible',
  delivery_method: 'not_eligible',
  usage_limit: 'usage_limit',
  per_buyer_limit: 'per_buyer_limit',
  min_not_met: 'min_not_met',
  not_combinable: 'not_combinable',
};

/** Both lists of `left` followed by those of `right`. */
export function mergeRefusals(left: Refusals, right: Refusals): Refusals {
  return {
    skipped: [...left.skipped, ...right.skipped],
    rejectedCodes: [...left.rejectedCodes, ...right.rejectedCodes],
  };
}

/** The offer skipped for `reason`, or its code rejected for the matching code reason when a code activated it. */
export function refusalOf(entry: RefusedEntry, reason: SkipReason): Refusals {
  if (entry.code === null) return { ...NO_REFUSALS, skipped: [{ offerId: entry.offer.id, reason }] };
  return { ...NO_REFUSALS, rejectedCodes: [{ code: entry.code, reason: CODE_REJECT_BY_SKIP[reason] }] };
}

/** Effects that are worth nothing only when the offer names no line of the cart (D2417, D2504). */
const LINE_EFFECTS: ReadonlySet<OfferOutcome['kind']> = new Set<OfferOutcome['kind']>(['line', 'gift']);

/**
 * The refusal of an offer whose effect is worth nothing: silent for an automatic offer (D2417), but a typed code whose
 * line or gift offer names no line of the cart is rejected `no_matching_items`. A zero order or delivery effect (an
 * empty subtotal, a delivery not chosen yet) stays silent: the code is not wrong.
 */
export function zeroEffectRefusal(entry: RefusedEntry, outcomeKind: OfferOutcome['kind']): Refusals {
  if (entry.code === null || !LINE_EFFECTS.has(outcomeKind)) return NO_REFUSALS;
  return { ...NO_REFUSALS, rejectedCodes: [{ code: entry.code, reason: 'no_matching_items' }] };
}
