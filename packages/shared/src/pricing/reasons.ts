/** Why an offer that matched the cart was not applied (D2417). */
export const SKIP_REASONS = [
  'no_tier_reached',
  'not_started',
  'ended',
  'audience',
  'channel',
  'wilaya',
  'delivery_method',
  'usage_limit',
  'per_buyer_limit',
  'min_not_met',
  'not_combinable',
] as const;

/** Why a submitted code gave no discount (D2417); the code is echoed normalised. */
export const CODE_REJECT_REASONS = [
  'not_found',
  'not_started',
  'ended',
  'inactive',
  'code_limit',
  'usage_limit',
  'per_buyer_limit',
  'not_eligible',
  'min_not_met',
  'no_matching_items',
  'not_combinable',
  'duplicate',
] as const;

/** Why a quote token failed verification; an unknown key id is a `bad_signature` (D2421). */
export const QUOTE_VERIFY_FAILURES = [
  'malformed',
  'bad_signature',
  'expired',
  'business_mismatch',
  'store_mismatch',
  'cart_mismatch',
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];
export type CodeRejectReason = (typeof CODE_REJECT_REASONS)[number];
export type QuoteVerifyFailure = (typeof QUOTE_VERIFY_FAILURES)[number];
