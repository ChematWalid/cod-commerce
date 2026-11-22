/** The log context of the delivery-pricing API's fault reports. */
export const DELIVERY_PRICING_LOG_CONTEXT = 'DeliveryPricingApi';

/** The name of the seeded fee group (D3124): our own name, never presented as a carrier's official grid. */
export const PLATFORM_DEFAULT_GROUP_NAME = 'Platform default prices';

/** The overweight settings of a seeded fee group (D3110): off, 5 kg allowance, 50 DZD per started extra kg. */
export const DEFAULT_CHARGE_OVERWEIGHT = false;
export const DEFAULT_OVERWEIGHT_ALLOWANCE_KG = 5;
export const DEFAULT_OVERWEIGHT_RATE = 50;
