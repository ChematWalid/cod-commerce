// The public entry of the offers (D2402, rule `offers-entry-infra-only`): another plugin imports it only from its
// infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does (frontends are API
// clients, ADR 0017). api/, application/, domain/ and dashboard/ never do, and the catalog never does
// (`catalog-no-offers`).
export { OffersPlugin, type OffersPluginOptions } from './offers.plugin';

// The use cases (D2408, D2431): inject them by class.
export { PricingService } from './application/pricing.service';
export type {
  OrderFieldLine,
  OrderFields,
  PricedOrderChange,
  RepriceInput,
  RepriceResult,
  UnpricedOrderChange,
} from './application/order-change';
export { OfferAdminService, type OfferSummaryPage } from './application/offer-admin.service';
export { OfferLifecycleService } from './application/offer-lifecycle.service';
export { OfferCodesService } from './application/offer-codes.service';
export { OfferUsageService, type RecordedOrderUses } from './application/offer-usage.service';
export { OrderAddonService, type OrderAddonInput } from './application/order-addon.service';
export { OfferStatsService } from './application/offer-stats.service';
export { OfferAppTypeService, type OfferAppTypeRegistrar } from './application/offer-app-type.service';
export { OfferPreviewService } from './application/offer-preview.service';
export type { OfferRecord, OfferSummaryRecord, StoredCode } from './domain/offer-record';
export { type OrderUsage, orderUsageOf } from './domain/engine/order-usage';
export type { TokenAddon, TokenUse } from './domain/engine/priced-quote';
export type { QuotePayload, QuoteRejectReason, QuoteVerification } from './domain/token/quote-token';
export { asOperationContext } from './domain/ports/operation-context.port';

// The seams (D2423): a sibling plugin injects a registrar token and calls `register(this)` on bootstrap.
export {
  BUYER_HISTORY_REGISTRAR,
  COLLECTION_MEMBERSHIP_REGISTRAR,
  OFFER_APP_TYPE_REGISTRAR,
  OFFER_PERFORMANCE_SOURCE_REGISTRAR,
  OFFER_USAGE_REGISTRAR,
  ORDER_ADDON_TARGET_REGISTRAR,
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
export type {
  AddonOrder,
  OrderAddonTarget,
  OrderAddonTargetRegistrar,
  PricedAddonLine,
} from './domain/ports/order-addon-target.port';
export type { OfferPerformanceRegistrar, OfferPerformanceSource } from './domain/ports/offer-performance.port';
export type { OfferOrderFact, OfferOrderState, OfferOrderUse } from './domain/performance';

// The dashboard's route paths and test ids, for the browser spec and the evidence script (framework-free).
export {
  ADD_QUANTITY_OFFER_TEST_ID,
  APP_TYPE_CARD_TEST_ID,
  ARABIC_PREVIEW_TEST_ID,
  CODES_PANEL_TEST_ID,
  CREATE_ALL_KINDS_TEST_ID,
  CREATE_BY_GOAL_TEST_ID,
  CREATE_DIALOG_TEST_ID,
  CREATE_OFFER_TEST_ID,
  EDITOR_DISCARD_TEST_ID,
  EDITOR_PUBLISH_TEST_ID,
  EDITOR_SAVE_TEST_ID,
  KIND_CHIPS_TEST_ID,
  NEW_OFFER_PATH,
  OFFER_EDITOR_TEST_ID,
  OFFER_LIST_TEST_ID,
  OFFER_ROW_TEST_ID,
  OFFER_TABS_TEST_ID,
  offerPathOf,
  OFFERS_EMPTY_TEST_ID,
  PRODUCT_OFFER_ROW_TEST_ID,
  PRODUCT_OFFERS_TEST_ID,
} from './dashboard/constants';
