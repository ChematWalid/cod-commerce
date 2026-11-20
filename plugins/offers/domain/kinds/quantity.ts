import { quantityConfigSchema, STAGE_QUANTITY, type OfferConfigWarning, type QuantityConfig } from '@cod/shared';
import type { OfferKindCalculator, PreviewCart } from '../engine/kind-registry';
import { BUY_TARGET_REQUIRED } from './target-rules';
import type { KindInput, OfferOutcome } from '../engine/outcome';
import { matchingLines } from '../engine/targets';
import { lineOutcome } from './line-outcome';
import { quantityNudge } from './quantity-nudge';
import { piecesOf, tierFor, unitDiscountAtTier } from './quantity-tiers';

export { nextTier, tierFor, unitPriceAtTier } from './quantity-tiers';

/**
 * A quantity offer: the highest tier the matched pieces reach prices every matched piece (D2409, D2410); a tier
 * with `freeDelivery` also waives the delivery fee, base and overweight (D2413, D2414).
 */
function evaluateQuantity(input: KindInput<QuantityConfig>): OfferOutcome {
  const { config, delivery } = input;
  const lines = matchingLines(input.offer, input.lines);
  if (lines.length === 0) return lineOutcome([], null);
  const tier = tierFor(config, piecesOf(lines));
  if (tier === undefined) return { kind: 'skip', reason: 'no_tier_reached' };
  const discounts = lines.map((line) => ({ line, perUnit: unitDiscountAtTier(config, tier, line) }));
  return lineOutcome(discounts, tier.freeDelivery ? delivery.baseFee + delivery.overweightFee : null);
}

/** A preview cart of `pieces` pieces of the matched product, without get line or add-on. */
const piecesCart = (pieces: number): PreviewCart => ({ pieces, withGet: false, withAddon: false });

/**
 * The carts the preview prices (D2516): one piece, as the buyer starts, then one cart per tier from two pieces up
 * (D2534), so the first tier's nudge shows.
 */
const quantityPreviewCarts = (config: QuantityConfig): readonly PreviewCart[] => [
  piecesCart(1),
  ...config.tiers.filter((tier) => tier.quantity > 1).map((tier) => piecesCart(tier.quantity)),
];

/**
 * `tier_total_not_divisible` when a tier's total does not split into whole DZD per piece (D2516): the engine prices
 * it per unit, half up (D2409), so the buyer pays a few DZD more or less than the total the merchant typed.
 */
const quantityConfigWarnings = (config: QuantityConfig): readonly OfferConfigWarning[] =>
  config.priceMode === 'total' && config.tiers.some((tier) => tier.price % tier.quantity !== 0)
    ? ['tier_total_not_divisible']
    : [];

/** The `quantity` kind: tiered prices by pieces, with a nudge toward the next tier. */
export const quantityCalculator: OfferKindCalculator<QuantityConfig> = {
  kind: 'quantity',
  combinationClass: 'product',
  stage: STAGE_QUANTITY,
  configSchema: quantityConfigSchema,
  evaluate: evaluateQuantity,
  nudge: quantityNudge,
  targetRules: () => BUY_TARGET_REQUIRED,
  previewCarts: quantityPreviewCarts,
  configWarnings: quantityConfigWarnings,
};
