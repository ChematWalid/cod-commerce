/** Nest injection token of the offers' quote key ring (D2422): the active kid signs quotes, every kid verifies. */
export const QUOTE_KEY_RING: unique symbol = Symbol('OffersQuoteKeyRing');

/** Injection tokens of the offers' ports; the adapters behind them are wired in `infrastructure/offers.providers.ts`. */
export const OFFER_REPOSITORY: unique symbol = Symbol('OffersOfferRepository');
export const OFFER_CODE_REPOSITORY: unique symbol = Symbol('OffersOfferCodeRepository');
export const ID_GENERATOR: unique symbol = Symbol('OffersIdGenerator');
export const CLOCK: unique symbol = Symbol('OffersClock');
export const PRICING_LOGGER: unique symbol = Symbol('OffersPricingLogger');
