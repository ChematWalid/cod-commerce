import type { Nudge, QuantityConfig } from '@cod/shared';
import { matchingLines } from '../engine/targets';
import type { KindInput } from '../engine/outcome';
import { nextTier, piecesOf, unitDiscountAtTier } from './quantity-tiers';

/**
 * "Add `units` more to save `saving`" toward the next tier of a quantity offer (D2416), or `null` when no line is
 * targeted or the top tier is reached. `saving` is the total discount at the next tier, delivery excluded: the
 * matched pieces at their tier discount plus each missing piece at the smallest unit discount among the matched
 * lines, so a cart of mixed prices never overstates it (D2436).
 */
export function quantityNudge(input: KindInput<QuantityConfig>): Nudge | null {
  const { config, offer } = input;
  const lines = matchingLines(offer, input.lines);
  const pieces = piecesOf(lines);
  const tier = nextTier(config, pieces);
  if (lines.length === 0 || tier === undefined) return null;
  const discounts = lines.map((line) => unitDiscountAtTier(config, tier, line));
  const units = tier.quantity - pieces;
  const matchedSaving = lines.reduce((sum, line, index) => sum + (discounts[index] ?? 0) * line.quantity, 0);
  const saving = matchedSaving + units * Math.min(...discounts);
  return { type: 'next_tier', offerId: offer.id, units, tierQuantity: tier.quantity, saving };
}
