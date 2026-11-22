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
