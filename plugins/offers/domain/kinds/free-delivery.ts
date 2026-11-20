import { freeDeliveryConfigSchema, STAGE_DELIVERY, type FreeDeliveryConfig, type Suggestion } from '@cod/shared';
import type { OfferKindCalculator } from '../engine/kind-registry';
import type { KindInput, OfferOutcome } from '../engine/outcome';
import { shortfallOf } from './threshold';

/**
 * Free delivery once the threshold is reached: it waives the base fee and the overweight fee (D2414). An unresolved
 * delivery has nothing to waive yet, so the outcome is worth 0: neither applied nor reported (D2417). Methods and
 * wilayas are filtered by the offer's eligibility, not here (D2413).
 */
function evaluateFreeDelivery(input: KindInput<FreeDeliveryConfig>): OfferOutcome {
  const { config, base, delivery } = input;
  if (!delivery.resolved) return { kind: 'delivery', value: 0 };
  if (shortfallOf(config.threshold, base) !== null) return { kind: 'skip', reason: 'min_not_met' };
  return { kind: 'delivery', value: delivery.baseFee + delivery.overweightFee };
}

/** "Add `missing` for free delivery" while the threshold is not reached (D2416); `null` once it is or without one. */
function suggestFreeDelivery(input: KindInput<FreeDeliveryConfig>): Suggestion | null {
  const missing = shortfallOf(input.config.threshold, input.base);
  if (missing === null) return null;
  return { type: 'free_delivery', offerId: input.offer.id, missing };
}

/** The `free_delivery` kind: delivery waived from a threshold, with a suggestion until it is reached. */
export const freeDeliveryCalculator: OfferKindCalculator<FreeDeliveryConfig> = {
  kind: 'free_delivery',
  combinationClass: 'delivery',
  stage: STAGE_DELIVERY,
  configSchema: freeDeliveryConfigSchema,
  evaluate: evaluateFreeDelivery,
  suggest: suggestFreeDelivery,
};
