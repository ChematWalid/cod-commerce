/** Stable error codes of the delivery-pricing API; clients map them to translated messages. */
export const DELIVERY_PRICING_ERROR_CODES = {
  INVALID_INPUT: 'delivery-pricing.invalid-input',
  NOT_FOUND: 'delivery-pricing.not-found',
  GROUP_IN_USE: 'delivery-pricing.group-in-use',
  /** A carrier id no carrier of the store holds; every non-null id until P5.S1 (D3109). */
  CARRIER_NOT_FOUND: 'delivery-pricing.carrier-not-found',
  /** A pricing CSV that is not strict UTF-8 CSV text with the expected columns (D3142). */
  CSV_INVALID_FILE: 'delivery-pricing.csv-invalid-file',
  /** A pricing CSV above `PRICING_CSV_MAX_BYTES` (D3142). */
  CSV_TOO_LARGE: 'delivery-pricing.csv-too-large',
  /** A pricing CSV with more rows than the option's wilayas and their communes (D3142). */
  CSV_TOO_MANY_ROWS: 'delivery-pricing.csv-too-many-rows',
  /** An apply of a pricing CSV that still has refused rows; a dry run lists them (D3142). */
  CSV_INVALID_ROWS: 'delivery-pricing.csv-invalid-rows',
} as const;

/** One of the {@link DELIVERY_PRICING_ERROR_CODES} values. */
export type DeliveryPricingErrorCode = (typeof DELIVERY_PRICING_ERROR_CODES)[keyof typeof DELIVERY_PRICING_ERROR_CODES];
