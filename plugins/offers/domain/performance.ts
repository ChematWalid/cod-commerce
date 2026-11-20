import type { OfferPerformance } from '@cod/shared';

/** Where an order stands for the offer stats (D2514): still open, delivered, or voided (cancelled, rejected). */
export const OFFER_ORDER_STATES = ['open', 'delivered', 'void'] as const;

export type OfferOrderState = (typeof OFFER_ORDER_STATES)[number];

/** One offer an order applied and the discount it gave there, in DZD. */
export interface OfferOrderUse {
  readonly offerId: string;
  readonly amount: number;
}

/** An order as the offer stats read it (D2514): its state, its total in DZD and the offers it applied. */
export interface OfferOrderFact {
  readonly orderId: string;
  readonly state: OfferOrderState;
  readonly total: number;
  readonly offers: readonly OfferOrderUse[];
}

const NO_PERFORMANCE: OfferPerformance = { orders: 0, deliveredRevenue: 0, discountGiven: 0 };

/** What `fact` adds to the performance of an offer it applied with `amount` in all. */
function withFact(performance: OfferPerformance, fact: OfferOrderFact, amount: number): OfferPerformance {
  return {
    orders: performance.orders + 1,
    deliveredRevenue: performance.deliveredRevenue + (fact.state === 'delivered' ? fact.total : 0),
    discountGiven: performance.discountGiven + amount,
  };
}

/** The discount `fact` gives under each offer it applied, an offer applied twice summed once. */
function amountsOf(fact: OfferOrderFact): ReadonlyMap<string, number> {
  const amounts = new Map<string, number>();
  for (const { offerId, amount } of fact.offers) amounts.set(offerId, (amounts.get(offerId) ?? 0) + amount);
  return amounts;
}

/**
 * The performance of each offer of `offerIds` over `facts` (D2514): `orders` counts the orders applying it that are
 * not voided, `deliveredRevenue` sums the totals of the delivered ones, `discountGiven` its discount over the orders
 * not voided. An offer no order applied answers zeros; an offer not asked for is left out.
 */
export function aggregatePerformance(
  facts: readonly OfferOrderFact[],
  offerIds: readonly string[],
): ReadonlyMap<string, OfferPerformance> {
  const performance = new Map<string, OfferPerformance>(offerIds.map((offerId) => [offerId, NO_PERFORMANCE]));
  for (const fact of facts) {
    if (fact.state === 'void') continue;
    for (const [offerId, amount] of amountsOf(fact)) {
      const current = performance.get(offerId);
      if (current !== undefined) performance.set(offerId, withFact(current, fact, amount));
    }
  }
  return performance;
}
