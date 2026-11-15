/** Nest injection token of the offers' quote key ring (D2422): the active kid signs quotes, every kid verifies. */
export const QUOTE_KEY_RING: unique symbol = Symbol('OffersQuoteKeyRing');

/** Injection tokens of the offers' ports; the adapters behind them are wired in `infrastructure/offers.providers.ts`. */
export const OFFER_REPOSITORY: unique symbol = Symbol('OffersOfferRepository');
export const OFFER_CODE_REPOSITORY: unique symbol = Symbol('OffersOfferCodeRepository');
export const ID_GENERATOR: unique symbol = Symbol('OffersIdGenerator');
export const CLOCK: unique symbol = Symbol('OffersClock');
export const PRICING_LOGGER: unique symbol = Symbol('OffersPricingLogger');

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
