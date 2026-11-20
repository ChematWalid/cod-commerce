import { quantityConfigSchema, STAGE_QUANTITY, type QuantityConfig } from '@cod/shared';
import type { OfferKindCalculator } from '../engine/kind-registry';
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

/** The `quantity` kind: tiered prices by pieces, with a nudge toward the next tier. */
export const quantityCalculator: OfferKindCalculator<QuantityConfig> = {
  kind: 'quantity',
  combinationClass: 'product',
  stage: STAGE_QUANTITY,
  configSchema: quantityConfigSchema,
  evaluate: evaluateQuantity,
  nudge: quantityNudge,
};
