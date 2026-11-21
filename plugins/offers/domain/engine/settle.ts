import type { AppliedOffer, OrderDiscount } from '@cod/shared';
import type { RunningLine } from '../cart';
import type { Offer } from '../offer';
import { deliveryFeeOf } from './delivery';
import { applyAddonOutcome, applyGiftOutcome, applyLineOutcome, type LineDiscounts } from './line-stage';
import type {
  AddonOutcome,
  DeliveryContext,
  DeliveryOutcome,
  EffectOutcome,
  GiftOutcome,
  LineOutcome,
  OrderOutcome,
} from './outcome';
import { baseOf, kindInputOf, type Candidate } from './pricing-state';
import { mergeRefusals, refusalOf, zeroEffectRefusal, type Refusals } from './refusals';

/** The cart once the accepted offers have applied. */
export interface SettledState {
  readonly lines: readonly RunningLine[];
  readonly lineDiscounts: LineDiscounts;
  readonly orderDiscounts: readonly OrderDiscount[];
  readonly waived: boolean;
  readonly applied: readonly AppliedOffer[];
  /** Whether an applied offer read the buyer's phone (D2421 `p`). */
  readonly phoneUsed: boolean;
  readonly refusals: Refusals;
}

/** What `settle` starts from. */
export interface SettleInput {
  readonly accepted: readonly Candidate[];
  readonly lines: readonly RunningLine[];
  readonly delivery: DeliveryContext;
  readonly refusals: Refusals;
}

type Effect = EffectOutcome;

/**
 * One effect applied to the state and the buyer saving it gave; `applied` when it applied at whatever saving (an
 * add-on at its list price, D2507), else it applied only if it saved the buyer something.
 */
type Applier<O extends Effect> = (
  state: SettledState,
  candidate: Candidate,
  outcome: O,
  delivery: DeliveryContext,
) => { readonly state: SettledState; readonly amount: number; readonly applied?: boolean };

/** Line discounts on the running prices; a tier's free delivery waives the fee once (D2413, D2414). */
const applyLine: Applier<LineOutcome> = (state, { offer }, outcome, delivery) => {
  const source = { offerId: offer.id, kind: offer.kind };
  const applied = applyLineOutcome({ lines: state.lines, lineDiscounts: state.lineDiscounts, outcome, source });
  const fee = outcome.freeDelivery && !state.waived ? deliveryFeeOf(delivery) : 0;
  const waived = state.waived || outcome.freeDelivery;
  return {
    state: { ...state, lines: applied.lines, lineDiscounts: applied.lineDiscounts, waived },
    amount: applied.saving + fee,
  };
};

/** Gifted units split off their lines into gift lines at the gift price (D2504); worth what the buyer no longer pays. */
const applyGift: Applier<GiftOutcome> = (state, { offer }, outcome) => {
  const source = { offerId: offer.id, kind: offer.kind };
  const applied = applyGiftOutcome({ lines: state.lines, lineDiscounts: state.lineDiscounts, outcome, source });
  return { state: { ...state, lines: applied.lines, lineDiscounts: applied.lineDiscounts }, amount: applied.saving };
};

/** Add-on lines appended at their add-on price (D2506), before the order stage reads the subtotal (D2507). */
const applyAddon: Applier<AddonOutcome> = (state, { offer }, outcome) => {
  const source = { offerId: offer.id, kind: offer.kind };
  const applied = applyAddonOutcome({ lines: state.lines, lineDiscounts: state.lineDiscounts, outcome, source });
  return {
    state: { ...state, lines: applied.lines, lineDiscounts: applied.lineDiscounts },
    amount: applied.saving,
    applied: outcome.lines.length > 0,
  };
};

/** An order discount, at most what the subtotal still has after earlier order discounts (Review Focus 3). */
const applyOrder: Applier<OrderOutcome> = (state, { offer, code }, outcome) => {
  const given = state.orderDiscounts.reduce((sum, discount) => sum + discount.amount, 0);
  const amount = Math.min(outcome.amount, baseOf(state.lines).subtotal - given);
  if (amount <= 0) return { state, amount: 0 };
  const discount: OrderDiscount = { offerId: offer.id, kind: offer.kind, amount, ...(code === null ? {} : { code }) };
  return { state: { ...state, orderDiscounts: [...state.orderDiscounts, discount] }, amount };
};

/** Delivery waived; worth nothing when an earlier offer already waived it. */
const applyDelivery: Applier<DeliveryOutcome> = (state, _candidate, outcome) => ({
  state: { ...state, waived: true },
  amount: state.waived ? 0 : outcome.value,
});

/** One applier per effect kind of the engine's outcome type (not per offer kind, §3a.7). */
const APPLIERS: { readonly [K in Effect['kind']]: Applier<Extract<Effect, { kind: K }>> } = {
  line: applyLine,
  gift: applyGift,
  order: applyOrder,
  delivery: applyDelivery,
  addon: applyAddon,
};

/** Whether the offer's price depends on who buys: an audience or a per-buyer limit (D2421). */
const readsBuyer = (offer: Offer): boolean => offer.eligibility.audience !== 'everyone' || offer.perBuyerLimit !== null;

/** The state with `candidate` reported as applied for `amount`. */
function withApplied(state: SettledState, { offer, code }: Candidate, amount: number): SettledState {
  const applied: AppliedOffer = { offerId: offer.id, kind: offer.kind, amount, ...(code === null ? {} : { code }) };
  return { ...state, applied: [...state.applied, applied], phoneUsed: state.phoneUsed || readsBuyer(offer) };
}

/** Re-evaluates one accepted candidate on the current state and applies it (D2411, D2412). */
function settleOne(state: SettledState, candidate: Candidate, delivery: DeliveryContext): SettledState {
  const outcome = candidate.calculator.evaluate(kindInputOf(candidate, state.lines, delivery));
  if (outcome.kind === 'skip')
    return { ...state, refusals: mergeRefusals(state.refusals, refusalOf(candidate, outcome.reason)) };
  const applier = APPLIERS[outcome.kind] as Applier<Effect>;
  const { state: next, amount, applied = amount > 0 } = applier(state, candidate, outcome, delivery);
  if (applied) return withApplied(next, candidate, amount);
  return { ...next, refusals: mergeRefusals(next.refusals, zeroEffectRefusal(candidate, outcome)) };
}

/**
 * Applies the accepted candidates in stage order (quantity, bxgy, product discount, add-on, order, delivery), each
 * re-evaluated on the running state: line offers stack on earlier line prices, order and delivery thresholds read
 * the subtotal after line offers. A candidate that no longer applies is refused with its reason.
 */
export function settle({ accepted, lines, delivery, refusals }: SettleInput): SettledState {
  const ordered = [...accepted].sort((left, right) => left.calculator.stage - right.calculator.stage);
  const start: SettledState = {
    lines,
    lineDiscounts: new Map(),
    orderDiscounts: [],
    waived: false,
    applied: [],
    phoneUsed: false,
    refusals,
  };
  return ordered.reduce((state, candidate) => settleOne(state, candidate, delivery), start);
}
