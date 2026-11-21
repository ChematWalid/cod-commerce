import type { PLATFORM_CURRENCY_CODE } from '../platform/platform-defaults';
import type { OrderPricingMode } from './channels';
import type { AddonRejectReason, CodeRejectReason, SkipReason } from './reasons';

/** A discount on one line, in whole DZD for the whole line. */
export interface LineDiscount {
  offerId: string;
  kind: string;
  amount: number;
}

/** A discount on the order (ADR 0004 "Quote discounts"); `code` when a code activated it. */
export interface OrderDiscount {
  offerId: string;
  kind: string;
  amount: number;
  code?: string;
}

/** One priced line; `totalPrice = unitPrice × quantity` always (D2409). */
export interface QuoteLine {
  key: string;
  productId: string;
  variantId: string;
  quantity: number;
  /** Unit price before offers, from the unit price resolver. */
  originalPrice: number;
  /** Unit price after line offers: what the order stores as `quotedUnitPrice`. */
  unitPrice: number;
  totalPrice: number;
  discounts: LineDiscount[];
  /** Set on a gift line split off a matched line: the buy-x-get-y offer that gifted it (D2504). */
  giftOf?: string;
  /** Set on an add-on line: the add-on offer that priced it (D2506). */
  addonOf?: string;
  /** On an add-on line: the cart variant it rides with, or null for an add-on offered on any order (D2506). */
  parentVariantId?: string | null;
}

/** What the buyer pays for delivery; `price = 0` and `waived` when an offer waives it (D2414). */
export interface DeliveryBlock {
  resolved: boolean;
  fee: number;
  overweightFee: number;
  waived: boolean;
  price: number;
  freeShipping: boolean;
  speed: string | null;
}

/** "Add `units` more to reach the next tier and save `saving` DZD" (D2416); wording stays in frontends. */
export interface Nudge {
  type: 'next_tier';
  offerId: string;
  units: number;
  tierQuantity: number;
  saving: number;
}

/** An unmet free-delivery threshold and what is missing to reach it (D2416). */
export interface FreeDeliverySuggestion {
  type: 'free_delivery';
  offerId: string;
  missing: { pieces?: number; amount?: number };
}

/** A buy-x-get-y gift the buyer earned but has not added: `units` of the offer's `get` items (D2504). */
export interface GiftSuggestion {
  type: 'gift';
  offerId: string;
  units: number;
}

/** A hint to the buyer. */
export type Suggestion = FreeDeliverySuggestion | GiftSuggestion;

/** An offer that gave its effect; `amount` is the buyer saving in DZD. */
export interface AppliedOffer {
  offerId: string;
  kind: string;
  amount: number;
  code?: string;
}

/** An offer that matched the cart but was not applied (D2417). */
export interface SkippedOffer {
  offerId: string;
  reason: SkipReason;
}

/** A submitted code that gave no discount, echoed normalised (D2417). */
export interface RejectedCode {
  code: string;
  reason: CodeRejectReason;
}

/** A requested add-on the quote dropped, and why (D2506). */
export interface RejectedAddon {
  offerId: string;
  variantId: string;
  reason: AddonRejectReason;
}

/**
 * A cart quote, shaped as the cart-quote response of the research plus `unavailableVariantIds` (D2425). Amounts are
 * whole DZD; `total = subtotal − discountTotal + delivery.price` (D2415). Without a token when a line is unavailable.
 */
export interface Quote {
  currency: typeof PLATFORM_CURRENCY_CODE;
  lines: QuoteLine[];
  discounts: OrderDiscount[];
  subtotal: number;
  discountTotal: number;
  delivery: DeliveryBlock;
  total: number;
  savings: number;
  nudge: Nudge | null;
  applied: AppliedOffer[];
  skipped: SkippedOffer[];
  rejectedCodes: RejectedCode[];
  rejectedAddons: RejectedAddon[];
  suggestions: Suggestion[];
  quoteToken: string | null;
  /** ISO-8601 instant the token expires, or null without a token. */
  expiresAt: string | null;
  available: boolean;
  orderPricingMode: OrderPricingMode;
  unavailableVariantIds: string[];
}
