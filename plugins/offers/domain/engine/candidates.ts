import type { RunningLine } from '../cart';
import type { Offer } from '../offer';
import { checkEligibility } from './eligibility';
import type { OfferKindRegistry } from './kind-registry';
import type { LineOutcome, OfferOutcome } from './outcome';
import { kindInputOf, type Candidate, type OfferEntry, type PricingContext } from './pricing-state';
import { mergeRefusals, NO_REFUSALS, refusalOf, zeroEffectRefusal, type Refusals } from './refusals';

/** The offers of one cart, sorted out before combination. */
export interface Assessment {
  readonly candidates: readonly Candidate[];
  /** Entries that pass eligibility, whatever their effect: nudges and suggestions read them. */
  readonly eligible: readonly OfferEntry[];
  readonly refusals: Refusals;
}

/** What assessing one entry gives. */
interface Verdict {
  readonly eligible: boolean;
  readonly candidate: Candidate | null;
  readonly refusals: Refusals;
}

/**
 * The entries the cart may get: active automatic offers and code offers a typed code activated (D2403). An offer of
 * an unknown kind is left out (the snapshot loader reports it, D2404).
 *
 * @throws InvalidOfferConfigError when a stored config no longer fits its kind's schema.
 */
export function entriesOf(
  registry: OfferKindRegistry,
  offers: readonly Offer[],
  activated: ReadonlyMap<string, string>,
): OfferEntry[] {
  return offers.flatMap((offer) => {
    const calculator = registry.get(offer.kind);
    const code = activated.get(offer.id) ?? null;
    if (calculator === undefined || offer.status !== 'active') return [];
    if (offer.method === 'codes' && code === null) return [];
    return [{ offer, calculator, config: registry.parseConfig(offer.kind, offer.config), code }];
  });
}

/** Keys of the lines a line outcome takes something off. */
const discountedLineKeysOf = (outcome: LineOutcome): string[] =>
  [...outcome.unitDiscounts].filter(([, perUnit]) => perUnit > 0).map(([key]) => key);

const isWorthless = (outcome: OfferOutcome): boolean => outcome.kind !== 'skip' && outcome.value === 0;

/**
 * One entry on the lines before offers. An automatic offer that touches nothing is silent whatever its eligibility
 * (D2417); otherwise eligibility reasons come before the kind's own, and a code reports what a silent offer hides.
 */
function verdictOf(entry: OfferEntry, lines: readonly RunningLine[], context: PricingContext): Verdict {
  const outcome = entry.calculator.evaluate(kindInputOf(entry, lines, context.delivery));
  const reason = checkEligibility(entry.offer, context.cart, context.snapshot);
  const eligible = reason === null;
  if (entry.code === null && isWorthless(outcome)) return { eligible, candidate: null, refusals: NO_REFUSALS };
  if (reason !== null) return { eligible, candidate: null, refusals: refusalOf(entry, reason) };
  if (outcome.kind === 'skip') return { eligible, candidate: null, refusals: refusalOf(entry, outcome.reason) };
  if (outcome.value === 0) return { eligible, candidate: null, refusals: zeroEffectRefusal(entry, outcome.kind) };
  const lineKeys = outcome.kind === 'line' ? discountedLineKeysOf(outcome) : [];
  const candidate = { ...entry, combinationClass: entry.calculator.combinationClass, value: outcome.value, lineKeys };
  return { eligible, candidate, refusals: NO_REFUSALS };
}

/** Sorts the entries into candidates, eligible entries and refusals, in entry order. */
export function assessOffers(
  entries: readonly OfferEntry[],
  lines: readonly RunningLine[],
  context: PricingContext,
): Assessment {
  const verdicts = entries.map((entry) => ({ entry, verdict: verdictOf(entry, lines, context) }));
  return {
    candidates: verdicts.flatMap(({ verdict }) => (verdict.candidate === null ? [] : [verdict.candidate])),
    eligible: verdicts.filter(({ verdict }) => verdict.eligible).map(({ entry }) => entry),
    refusals: verdicts.reduce((all, { verdict }) => mergeRefusals(all, verdict.refusals), NO_REFUSALS),
  };
}
