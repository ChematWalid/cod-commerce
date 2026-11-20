import type { PricingCart } from '../cart';
import type { Offer } from '../offer';
import type { PricingSnapshot } from '../snapshot';

/** Why an offer's usage limits refuse it. */
export type LimitMiss = 'usage_limit' | 'per_buyer_limit';

/**
 * Whether the offer still has uses left: in total (its `usageCount` column) and for this buyer (the injected
 * per-buyer counts, D2418). A per-buyer limit cannot be checked without a phone, so it refuses the offer then (D2435).
 *
 * @returns `null` when uses are left, else the reason.
 */
export function checkUsageLimits(offer: Offer, cart: PricingCart, snapshot: PricingSnapshot): LimitMiss | null {
  if (offer.totalUsageLimit !== null && offer.usageCount >= offer.totalUsageLimit) return 'usage_limit';
  if (offer.perBuyerLimit === null) return null;
  if (cart.buyer === null) return 'per_buyer_limit';
  const used = snapshot.perBuyerUsage.get(offer.id) ?? 0;
  return used >= offer.perBuyerLimit ? 'per_buyer_limit' : null;
}
