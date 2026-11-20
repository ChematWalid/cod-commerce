/** Stable error codes of pricing and offers; clients map them to translated messages, never to input (D2434). */
export const PRICING_ERROR_CODES = {
  INVALID_REQUEST: 'pricing.invalid-request',
  TOTAL_TOO_LARGE: 'pricing.total-too-large',
  NO_ACTIVE_STORE: 'pricing.no-active-store',
  OFFER_NOT_FOUND: 'offers.offer-not-found',
  INVALID_CONFIG: 'offers.invalid-config',
  UNKNOWN_KIND: 'offers.unknown-kind',
  CODE_TAKEN: 'offers.code-taken',
  INVALID_TRANSITION: 'offers.invalid-transition',
  OFFER_CONFLICT: 'offers.offer-conflict',
  CODE_METHOD_REQUIRED: 'offers.code-method-required',
} as const;

/** One of the {@link PRICING_ERROR_CODES} values. */
export type PricingErrorCode = (typeof PRICING_ERROR_CODES)[keyof typeof PRICING_ERROR_CODES];

/** The issue message of every shape refusal of a quote request. */
export const invalidQuoteRequest = { message: PRICING_ERROR_CODES.INVALID_REQUEST };
/** The issue message of every shape refusal of an offer or its kind configuration. */
export const invalidOfferConfig = { message: PRICING_ERROR_CODES.INVALID_CONFIG };
