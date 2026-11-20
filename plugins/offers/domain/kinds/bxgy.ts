import {
  bxgyConfigSchema,
  percentOf,
  STAGE_BXGY,
  type BxgyConfig,
  type BxgyGetSource,
  type BxgyGift,
  type OfferTargetRole,
  type Suggestion,
} from '@cod/shared';
import type { RunningLine } from '../cart';
import type { OfferKindCalculator, PreviewCart, TargetRules } from '../engine/kind-registry';
import type { GiftOutcome, KindInput, OfferOutcome } from '../engine/outcome';
import { matchingLines, matchingLinesByRole } from '../engine/targets';
import { giftUnits } from './gift-units';
import { piecesOf } from './quantity-tiers';

/** How many times a cart earns the gift and the lines it reads (D2504). */
interface GiftPlan {
  /** The lines the buyer buys: none means the offer names nothing in the cart. */
  readonly buyLines: readonly RunningLine[];
  readonly times: number;
  /** The lines gifts may be taken from. */
  readonly giftable: readonly RunningLine[];
  /** Whether a missing gift unit is suggested to the buyer (only one of other products can be missing). */
  readonly suggestsMissing: boolean;
}

type GiftOf<M extends BxgyGift['mode']> = Extract<BxgyGift, { mode: M }>;

/** The price of one gifted unit from its running price, by gift mode (§3a.7), clamped at 0 (D2503). */
const GIFT_PRICERS: { readonly [M in BxgyGift['mode']]: (gift: GiftOf<M>, unitPrice: number) => number } = {
  free: () => 0,
  percent: ({ value }, unitPrice) => unitPrice - percentOf(unitPrice, value),
  fixed: ({ value }, unitPrice) => Math.max(0, unitPrice - value),
};

const giftPriceOf = (gift: BxgyGift, unitPrice: number): number =>
  (GIFT_PRICERS[gift.mode] as (gift: BxgyGift, unitPrice: number) => number)(gift, unitPrice);

/** `earned` times, at most `maxTimesPerOrder` when the config caps it. */
const cappedTimes = (config: BxgyConfig, earned: number): number =>
  config.maxTimesPerOrder === null ? earned : Math.min(earned, config.maxTimesPerOrder);

/** Gifts of more of the matched items: every `buy + get` pieces earn `get` of them (D2504). */
function sameItemsPlan({ offer, config, lines }: KindInput<BxgyConfig>): GiftPlan {
  const matched = matchingLines(offer, lines, config.appliesTo);
  const times = cappedTimes(config, Math.floor(piecesOf(matched) / (config.buyQuantity + config.getQuantity)));
  return { buyLines: matched, times, giftable: matched, suggestsMissing: false };
}

/** Gifts of the `get` targets: every `buy` pieces bought earn `get` units of a get line that is not bought (D2504). */
function getTargetsPlan({ offer, config, lines }: KindInput<BxgyConfig>): GiftPlan {
  const explicitBuys = new Set(matchingLines(offer, lines).map((line) => line.key));
  const giftable = matchingLinesByRole(offer, lines, 'get').filter((line) => !explicitBuys.has(line.key));
  const getKeys = new Set(giftable.map((line) => line.key));
  const buyLines = matchingLines(offer, lines, config.appliesTo).filter((line) => !getKeys.has(line.key));
  const times = cappedTimes(config, Math.floor(piecesOf(buyLines) / config.buyQuantity));
  return { buyLines, times, giftable, suggestsMissing: true };
}

/** One plan per gift source (§3a.7). */
const PLANNERS: Readonly<Record<BxgyGetSource, (input: KindInput<BxgyConfig>) => GiftPlan>> = {
  same: sameItemsPlan,
  targets: getTargetsPlan,
};

const planOf = (input: KindInput<BxgyConfig>): GiftPlan => PLANNERS[input.config.getFrom](input);

/** The gift outcome of `units` per line: each unit at its gift price, worth what the buyer no longer pays. */
function giftOutcome(config: BxgyConfig, plan: GiftPlan): GiftOutcome {
  const gifts = giftUnits({ lines: plan.giftable, units: plan.times * config.getQuantity });
  const unitPrices = new Map<string, number>();
  let value = 0;
  for (const line of plan.giftable) {
    const units = gifts.get(line.key) ?? 0;
    if (units === 0) continue;
    const price = giftPriceOf(config.gift, line.unitPrice);
    unitPrices.set(line.key, price);
    value += (line.unitPrice - price) * units;
  }
  return { kind: 'gift', gifts, unitPrices, value, namesLine: true };
}

const NO_GIFT: GiftOutcome = { kind: 'gift', gifts: new Map(), unitPrices: new Map(), value: 0, namesLine: false };

/**
 * A buy-x-get-y offer (D2503, D2504): silent when it names no line, skipped `no_tier_reached` below its first gift,
 * else the earned gift units, cheapest first, at the gift price.
 */
function evaluateBxgy(input: KindInput<BxgyConfig>): OfferOutcome {
  const plan = planOf(input);
  if (plan.buyLines.length === 0) return NO_GIFT;
  if (plan.times === 0) return { kind: 'skip', reason: 'no_tier_reached' };
  return giftOutcome(input.config, plan);
}

/**
 * "Add `units` of the gift" when the buyer earned more gift units of another product than the cart holds (D2504):
 * units already gifted to this offer and get units still in the cart both count.
 */
function suggestBxgy(input: KindInput<BxgyConfig>): Suggestion | null {
  const plan = planOf(input);
  if (!plan.suggestsMissing || plan.times === 0) return null;
  const gifted = piecesOf(input.lines.filter((line) => line.giftOf === input.offer.id));
  const units = plan.times * input.config.getQuantity - gifted - piecesOf(plan.giftable);
  return units > 0 ? { type: 'gift', offerId: input.offer.id, units } : null;
}

/** Buy targets are needed when it applies to them, get targets when the gift comes from them (D2503). */
function bxgyTargetRules(config: BxgyConfig): TargetRules {
  const required: OfferTargetRole[] = [];
  if (config.appliesTo === 'targets') required.push('buy');
  if (config.getFrom === 'targets') required.push('get');
  return { allowed: ['buy', 'get'], required };
}

/**
 * One cart of `buy + get` pieces (D2516); when the gift comes from the get targets, `get` of them on a get line
 * (D2534).
 */
function bxgyPreviewCarts(config: BxgyConfig): readonly PreviewCart[] {
  const pieces = config.buyQuantity + config.getQuantity;
  if (config.getFrom === 'same') return [{ pieces, withGet: false, withAddon: false }];
  return [{ pieces, withGet: true, getPieces: config.getQuantity, withAddon: false }];
}

/** The `bxgy` kind: buy N, get M gifted, as gift lines split off the matched lines (D2503, D2504). */
export const bxgyCalculator: OfferKindCalculator<BxgyConfig> = {
  kind: 'bxgy',
  combinationClass: 'product',
  stage: STAGE_BXGY,
  configSchema: bxgyConfigSchema,
  evaluate: evaluateBxgy,
  suggest: suggestBxgy,
  targetRules: bxgyTargetRules,
  previewCarts: bxgyPreviewCarts,
};
