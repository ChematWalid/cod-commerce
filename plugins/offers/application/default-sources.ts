import { FIRST_ORDER_COUNT } from '../domain/constants';
import type { BuyerHistory } from '../domain/ports/buyer-history.port';
import type { CollectionMembership } from '../domain/ports/collection-membership.port';
import { OrderAddonUnavailableError } from '../domain/errors';
import type { OfferPerformanceSource } from '../domain/ports/offer-performance.port';
import type { OfferUsageCounts } from '../domain/ports/offer-usage.port';
import type { OrderAddonTarget } from '../domain/ports/order-addon-target.port';
import type { ShippingQuoteSource } from '../domain/ports/shipping-quote.port';
import { UNRESOLVED_SHIPPING } from '../domain/snapshot';
import { SingleSourceRegistry } from './single-source.registry';

/** No product is in any collection until P2.S3 registers its source: collection targets are inert (D2423). */
const NO_COLLECTION_MEMBERSHIP: CollectionMembership = {
  collectionsOf: () => Promise.resolve(new Map<string, readonly string[]>()),
};

/** Every delivery is unresolved, with fees 0, until P3.S1 registers its fee table (D2423). */
const UNRESOLVED_SHIPPING_QUOTE: ShippingQuoteSource = { quote: () => Promise.resolve(UNRESOLVED_SHIPPING) };

/** No order exists before P3.S4, so every phone is a first-time buyer (D2418). */
const NO_BUYER_HISTORY: BuyerHistory = { orderCountOf: () => Promise.resolve(FIRST_ORDER_COUNT) };

/** No offer was used before P3.S4 counts uses (D2418). */
const NO_OFFER_USAGE: OfferUsageCounts = { perBuyer: () => Promise.resolve(new Map<string, number>()) };

/** No order exists before P3.S4 registers its order source, so no add-on can be appended (D2508). */
const UNREGISTERED_ORDER_ADDON_TARGET: OrderAddonTarget = {
  orderOf: () => Promise.reject(new OrderAddonUnavailableError()),
  appendLine: () => Promise.reject(new OrderAddonUnavailableError()),
};

/** No order exists before P3.S4 registers its order source, so every offer's stats are zeros (D2514). */
const NO_ORDER_FACTS: OfferPerformanceSource = { factsOf: () => Promise.resolve([]) };

/** The collection membership seam, answering no memberships until P2.S3 registers. */
export const newCollectionMembershipRegistry = (): SingleSourceRegistry<CollectionMembership> =>
  new SingleSourceRegistry('collection membership source', NO_COLLECTION_MEMBERSHIP);

/** The shipping quote seam, answering an unresolved delivery until P3.S1 registers. */
export const newShippingQuoteRegistry = (): SingleSourceRegistry<ShippingQuoteSource> =>
  new SingleSourceRegistry('shipping quote source', UNRESOLVED_SHIPPING_QUOTE);

/** The buyer history seam, counting no orders until P3.S4 registers. */
export const newBuyerHistoryRegistry = (): SingleSourceRegistry<BuyerHistory> =>
  new SingleSourceRegistry('buyer history source', NO_BUYER_HISTORY);

/** The per-buyer offer usage seam, counting no uses until P3.S4 registers. */
export const newOfferUsageRegistry = (): SingleSourceRegistry<OfferUsageCounts> =>
  new SingleSourceRegistry('offer usage source', NO_OFFER_USAGE);

/** The order source of post-order add-ons, refusing every call until P3.S4 registers. */
export const newOrderAddonTargetRegistry = (): SingleSourceRegistry<OrderAddonTarget> =>
  new SingleSourceRegistry('order add-on target', UNREGISTERED_ORDER_ADDON_TARGET);

/** The order facts of the offer stats, answering no order until P3.S4 registers (D2514). */
export const newOfferPerformanceRegistry = (): SingleSourceRegistry<OfferPerformanceSource> =>
  new SingleSourceRegistry('offer performance source', NO_ORDER_FACTS);
