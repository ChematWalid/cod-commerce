/** Stable error codes of the delivery-pricing API; clients map them to translated messages. */
export const DELIVERY_PRICING_ERROR_CODES = {
  INVALID_INPUT: 'delivery-pricing.invalid-input',
  NOT_FOUND: 'delivery-pricing.not-found',
  GROUP_IN_USE: 'delivery-pricing.group-in-use',
} as const;

/** One of the {@link DELIVERY_PRICING_ERROR_CODES} values. */
export type DeliveryPricingErrorCode = (typeof DELIVERY_PRICING_ERROR_CODES)[keyof typeof DELIVERY_PRICING_ERROR_CODES];
