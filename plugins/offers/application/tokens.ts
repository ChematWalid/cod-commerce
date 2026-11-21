/** Nest injection token of the offers' quote key ring (D2422): the active kid signs quotes, every kid verifies. */
export const QUOTE_KEY_RING: unique symbol = Symbol('OffersQuoteKeyRing');

/** Injection tokens of the offers' ports; the adapters behind them are wired in `infrastructure/offers.providers.ts`. */
export const OFFER_REPOSITORY: unique symbol = Symbol('OffersOfferRepository');
export const OFFER_CODE_REPOSITORY: unique symbol = Symbol('OffersOfferCodeRepository');
export const ID_GENERATOR: unique symbol = Symbol('OffersIdGenerator');
export const CLOCK: unique symbol = Symbol('OffersClock');
export const PRICING_LOGGER: unique symbol = Symbol('OffersPricingLogger');
export const OFFER_USAGE_COUNTER: unique symbol = Symbol('OffersOfferUsageCounter');

/** Which store a request prices: the resolved tenant's active store on its own channel (D2408). */
export const ACTIVE_STORE: unique symbol = Symbol('OffersActiveStore');

/** The kinds of offer the engine prices (D2404), one registry for the admin use case and the pricing service. */
export const OFFER_KIND_REGISTRY: unique symbol = Symbol('OffersOfferKindRegistry');

/** What the pricing service reads each quote's snapshot from (D2424): the loader, or P3.S3's cache wrapping it. */
export const PRICING_SNAPSHOT_SOURCE: unique symbol = Symbol('OffersPricingSnapshotSource');

/** The store-channel variant gate every unit price starts from (D2423). */
export const VARIANT_GATE: unique symbol = Symbol('OffersVariantGate');

/**
 * The seams (D2423): each `…_REGISTRAR` is where another plugin registers its source on bootstrap, and the token
 * without the suffix is what the pricing snapshot reads (the same registry instance).
 */
export const UNIT_PRICE_RESOLVER: unique symbol = Symbol('OffersUnitPriceResolver');
export const UNIT_PRICE_RESOLVER_REGISTRAR: unique symbol = Symbol('OffersUnitPriceResolverRegistrar');
export const COLLECTION_MEMBERSHIP: unique symbol = Symbol('OffersCollectionMembership');
export const COLLECTION_MEMBERSHIP_REGISTRAR: unique symbol = Symbol('OffersCollectionMembershipRegistrar');
export const SHIPPING_QUOTE: unique symbol = Symbol('OffersShippingQuote');
export const SHIPPING_QUOTE_REGISTRAR: unique symbol = Symbol('OffersShippingQuoteRegistrar');
export const BUYER_HISTORY: unique symbol = Symbol('OffersBuyerHistory');
export const BUYER_HISTORY_REGISTRAR: unique symbol = Symbol('OffersBuyerHistoryRegistrar');
export const OFFER_USAGE: unique symbol = Symbol('OffersOfferUsage');
export const OFFER_USAGE_REGISTRAR: unique symbol = Symbol('OffersOfferUsageRegistrar');

/** The orders a post-order add-on is appended to (D2508), registered by P3.S4; same registry behind both tokens. */
export const ORDER_ADDON_TARGET: unique symbol = Symbol('OffersOrderAddonTarget');
export const ORDER_ADDON_TARGET_REGISTRAR: unique symbol = Symbol('OffersOrderAddonTargetRegistrar');

/** Where the offers publish their domain events (D2509): the platform outbox. */
export const OFFER_EVENTS: unique symbol = Symbol('OffersOfferEvents');

/** Where generated discount codes draw their random part (D2512). */
export const RANDOM_CODE_SOURCE: unique symbol = Symbol('OffersRandomCodeSource');

/** The variants of a store's product, read on the store's channel (D2513). */
export const PRODUCT_VARIANTS: unique symbol = Symbol('OffersProductVariants');

/** The variants, products and collections an offer target may name, read for the store (D2537, D2342). */
export const OFFER_TARGET_CATALOG: unique symbol = Symbol('OffersOfferTargetCatalog');

/** The orders the offer stats read (D2514), registered by P3.S4; same registry behind both tokens. */
export const OFFER_PERFORMANCE_SOURCE: unique symbol = Symbol('OffersOfferPerformanceSource');
export const OFFER_PERFORMANCE_SOURCE_REGISTRAR: unique symbol = Symbol('OffersOfferPerformanceSourceRegistrar');

/** Where an app registers its own card of the create dialog (D2515): the `OfferAppTypeService` itself. */
export const OFFER_APP_TYPE_REGISTRAR: unique symbol = Symbol('OffersOfferAppTypeRegistrar');
