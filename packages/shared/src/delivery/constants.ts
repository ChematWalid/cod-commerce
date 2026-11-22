/** Longest name of a delivery fee group ("pricing option"). */
export const FEE_GROUP_NAME_MAX = 80;

/** Highest home or stop-desk price of one wilaya, in whole DZD (ADR 0004). */
export const MAX_DELIVERY_PRICE = 100_000;

/** Highest weight, in kg, a fee group lets ship before overweight is charged. */
export const MAX_OVERWEIGHT_ALLOWANCE_KG = 100;

/** Highest overweight rate, in whole DZD per started extra kg. */
export const MAX_OVERWEIGHT_RATE = 10_000;

/** Delivery speeds a quote may offer: only `standard` until carriers expose express (P5, D3113). */
export const DELIVERY_SPEEDS = ['standard'] as const;

/** A delivery speed. */
export type DeliverySpeed = (typeof DELIVERY_SPEEDS)[number];

/** Translation key of the name of the seeded "Platform default prices" fee group (D3110). */
export const DEFAULT_FEE_GROUP_NAME_KEY = 'delivery-pricing.platform-default-prices';

/** An upper bound on the commune rows of one wilaya in a call, above the largest wilaya (Tizi Ouzou, 67 communes). */
export const MAX_COMMUNE_RATES_PER_WILAYA = 100;

/** Highest ONS commune code (`codeOns`): six digits at most. */
export const ONS_CODE_MAX = 999_999;

/** Fee groups on one page of the list by default. */
export const FEE_GROUP_LIST_PAGE_SIZE = 20;

/** Most fee groups one page of the list may hold. */
export const FEE_GROUP_LIST_MAX_TAKE = 100;
