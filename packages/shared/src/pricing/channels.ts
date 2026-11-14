/** Where a quote is asked from; an offer with no channel listed applies on all of them (D2420). */
export const PRICING_CHANNELS = ['storefront', 'landing_page', 'order_form_app', 'dashboard', 'app'] as const;
/** Home delivery or a carrier desk (stop desk). */
export const DELIVERY_METHODS = ['home', 'desk'] as const;
/** Buyers an offer is for: everyone, a first order, or buyers who ordered before (D2418). */
export const AUDIENCES = ['everyone', 'first', 'returning'] as const;
/** How a buyer gets an offer: applied by itself, or by typing one of its codes (D2403). */
export const OFFER_METHODS = ['automatic', 'codes'] as const;
/** Lifecycle of an offer; only `active` offers are priced (D2419). */
export const OFFER_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;
/** What an offer discounts; `combinesWith` is keyed by these (D2411). */
export const COMBINATION_CLASSES = ['product', 'order', 'delivery'] as const;
/** How an order keeps the quoted prices (D2426). */
export const ORDER_PRICING_MODES = ['quote'] as const;
/** Role of an offer target; P2.S5 appends `get` and `addon`. */
export const OFFER_TARGET_ROLES = ['buy'] as const;
/** What an offer target names. */
export const TARGET_REF_TYPES = ['variant', 'product', 'collection'] as const;
/** A quantity tier price is a percent off, or the total of the tier's pieces (D2409). */
export const QUANTITY_PRICE_MODES = ['percent', 'total'] as const;
/** A discount is a percent or a fixed amount of DZD. */
export const DISCOUNT_VALUE_TYPES = ['percent', 'fixed'] as const;
/** What a product discount covers: every product, or the offer's targets. */
export const PRODUCT_DISCOUNT_SCOPES = ['all', 'targets'] as const;

export type PricingChannel = (typeof PRICING_CHANNELS)[number];
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];
export type Audience = (typeof AUDIENCES)[number];
export type OfferMethod = (typeof OFFER_METHODS)[number];
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type CombinationClass = (typeof COMBINATION_CLASSES)[number];
export type OrderPricingMode = (typeof ORDER_PRICING_MODES)[number];
export type OfferTargetRole = (typeof OFFER_TARGET_ROLES)[number];
export type TargetRefType = (typeof TARGET_REF_TYPES)[number];
export type QuantityPriceMode = (typeof QUANTITY_PRICE_MODES)[number];
export type DiscountValueType = (typeof DISCOUNT_VALUE_TYPES)[number];
export type ProductDiscountScope = (typeof PRODUCT_DISCOUNT_SCOPES)[number];
