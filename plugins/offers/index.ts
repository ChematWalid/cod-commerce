// The public entry of the offers (D2402, rule `offers-entry-infra-only`): another plugin imports it only from its
// infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does (frontends are API
// clients, ADR 0017). api/, application/, domain/ and dashboard/ never do, and the catalog never does
// (`catalog-no-offers`). Later tasks add PricingService and OfferAdminService.
export { OffersPlugin, type OffersPluginOptions } from './offers.plugin';

// The seams (D2423): a sibling plugin injects a registrar token and calls `register(this)` on bootstrap.
export {
  BUYER_HISTORY_REGISTRAR,
  COLLECTION_MEMBERSHIP_REGISTRAR,
  OFFER_USAGE_REGISTRAR,
  SHIPPING_QUOTE_REGISTRAR,
  UNIT_PRICE_RESOLVER_REGISTRAR,
} from './application/tokens';
export type { CoreId } from './domain/core-id';
export type { BuyerRef } from './domain/cart';
export type { OperationContext } from './domain/ports/operation-context.port';
export type { StoreScope } from './domain/store-scope';
export type { ShippingQuoteResult } from './domain/snapshot';
export type {
  GatedLine,
  ResolverContext,
  ResolverPrice,
  UnitPriceResolver,
  UnitPriceResolverRegistrar,
} from './domain/ports/unit-price-resolver.port';
export type { CollectionMembership, CollectionMembershipRegistrar } from './domain/ports/collection-membership.port';
export type {
  ShippingQuoteInput,
  ShippingQuoteItem,
  ShippingQuoteRegistrar,
  ShippingQuoteSource,
} from './domain/ports/shipping-quote.port';
export type { BuyerHistory, BuyerHistoryRegistrar } from './domain/ports/buyer-history.port';
export type { OfferUsageCounts, OfferUsageRegistrar } from './domain/ports/offer-usage.port';
