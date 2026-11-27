import type { PlatformLanguageCode } from '../platform/platform-defaults';

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

/** Where a quote's price came from (D3125): a commune row's price, else the wilaya row's. */
export const QUOTE_PRICE_SOURCES = ['commune', 'wilaya'] as const;

/** Where a quote's price came from. */
export type QuotePriceSource = (typeof QUOTE_PRICE_SOURCES)[number];

/** Translation key of the name of the seeded "Platform default prices" fee group (D3110). */
export const DEFAULT_FEE_GROUP_NAME_KEY = 'delivery-pricing.platform-default-prices';

/**
 * The name the seeded "Platform default prices" fee group gets, in its store's language (D3124): stored once at seed
 * time, so a merchant can rename it like any other group.
 */
export const PLATFORM_DEFAULT_FEE_GROUP_NAMES: Readonly<Record<PlatformLanguageCode, string>> = {
  ar: 'أسعار المنصة الافتراضية',
  fr: 'Prix par défaut de la plateforme',
  en: 'Platform default prices',
};

/** An upper bound on the commune rows of one wilaya in a call, above the largest wilaya (Tizi Ouzou, 67 communes). */
export const MAX_COMMUNE_RATES_PER_WILAYA = 100;

/** Highest ONS commune code (`codeOns`): six digits at most. */
export const ONS_CODE_MAX = 999_999;

/** Fee groups on one page of the list by default. */
export const FEE_GROUP_LIST_PAGE_SIZE = 20;

/** Most fee groups one page of the list may hold. */
export const FEE_GROUP_LIST_MAX_TAKE = 100;

/**
 * An upper bound on the wilayas one price adjustment names, above the wilaya count; the API checks each one against the
 * group's stored rows, so the bound is never the count itself.
 */
export const MAX_ADJUST_PROVINCES = 100;

/** Lowest percent a price adjustment takes: -100 % brings a price to 0. */
export const MIN_PRICE_ADJUST_PERCENT = -100;

/** Highest percent a price adjustment takes (an elevenfold price); the result is clamped to `MAX_DELIVERY_PRICE`. */
export const MAX_PRICE_ADJUST_PERCENT = 1000;

/** How a price adjustment reads its value: whole DZD added, or a percent of the price (rounded half up). */
export const PRICE_ADJUSTMENT_KINDS = ['amount', 'percent'] as const;

/** A kind of price adjustment. */
export type PriceAdjustmentKind = (typeof PRICE_ADJUSTMENT_KINDS)[number];
