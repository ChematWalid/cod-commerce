/** The log context of the delivery-pricing API's fault reports. */
export const DELIVERY_PRICING_LOG_CONTEXT = 'DeliveryPricingApi';

/** The overweight settings of a seeded fee group (D3110): off, 5 kg allowance, 50 DZD per started extra kg. */
export const DEFAULT_CHARGE_OVERWEIGHT = false;
export const DEFAULT_OVERWEIGHT_ALLOWANCE_KG = 5;
export const DEFAULT_OVERWEIGHT_RATE = 50;

/** Stores read per page by the migrate converge of default tables (D3112); tenancy caps a page at 500. */
export const CONVERGE_PAGE_SIZE = 500;

/** The most failed stores a converge error lists in its message; the migrate logs every one. */
export const CONVERGE_REPORTED_FAILURES = 20;

/** Grams in a kilogram: product weights are in grams (D2125), the overweight allowance in kg (D3121). */
export const GRAMS_PER_KG = 1000;

/**
 * The commune of an offers quote destination, sent as text: an ONS code of one to six digits without a leading zero
 * (`String(codeOns)`). Anything else answers unresolved, so a bad commune never falls back to the wilaya price.
 */
export const TOWN_ONS_PATTERN = /^[1-9]\d{0,5}$/;

/** The export file of a pricing option is `delivery-pricing-<group id>.csv` (D3142). */
export const PRICING_CSV_FILE_PREFIX = 'delivery-pricing-';
export const PRICING_CSV_FILE_SUFFIX = '.csv';

/** The longest CSV record a pricing import reads, in characters: a row is a few dozen, so a huge one is refused. */
export const PRICING_CSV_MAX_RECORD_CHARS = 4096;
