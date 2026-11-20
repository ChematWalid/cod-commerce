import {
  MAX_LINE_OFFERS_APPLIED,
  MAX_ORDER_DISCOUNTS_APPLIED,
  MAX_QUOTE_LINES,
  type CombinationClass,
} from '@cod/shared';

/** Orders a buyer has before their first one: a `first` audience offer is for a buyer with this many (D2418). */
export const FIRST_ORDER_COUNT = 0;

/**
 * Target roles whose lines an offer counts and discounts (D2410). A set, not a comparison: P2.S5 adds the `get` and
 * `addon` roles, which are not bought lines.
 */
export const BUY_ROLES: ReadonlySet<string> = new Set(['buy']);

/** Milliseconds per second: token instants are integer epoch seconds (D2421). */
export const MS_PER_SECOND = 1_000;

/** Dot-separated parts of a quote token: `qt1.<payload>.<signature>` (D2421). */
export const QUOTE_TOKEN_PART_COUNT = 3;

/** The unpadded base64url alphabet of a token's payload and signature parts. */
export const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * First value a sign `issuedAt` may not reach: epoch seconds stay below it until the year 5138, while epoch
 * milliseconds of any date after 1973 are above it, so a clock read in milliseconds is caught (D2421).
 */
export const EPOCH_SECONDS_LIMIT = 100_000_000_000;

/**
 * Most candidates of a combination class one quote accepts (D2411): order discounts are listed once per quote in the
 * token (`d`), so they are bounded per quote; a waived delivery is one flag whatever its count.
 */
export const ACCEPTED_LIMIT_PER_QUOTE_BY_CLASS: Readonly<Partial<Record<CombinationClass, number>>> = {
  order: MAX_ORDER_DISCOUNTS_APPLIED,
};

/**
 * Most candidates of a combination class one line carries (D2411): a token line lists its own `offerIds`, so line
 * offers are bounded per line, and offers on other lines never count against each other.
 */
export const ACCEPTED_LIMIT_PER_LINE_BY_CLASS: Readonly<Partial<Record<CombinationClass, number>>> = {
  product: MAX_LINE_OFFERS_APPLIED,
};

/** Width of the short enum-like columns (`method`, `status`, target `role` and `refType`); every value is shorter. */
export const ENUM_COLUMN_LENGTH = 16;

/** The `source` of a unit price no resolver claimed: the variant's channel list price (D2423). */
export const LIST_PRICE_SOURCE = 'variant';

/**
 * Most delivery-class offers one quote applies: the first waives the delivery fee, and any later one is worth nothing
 * and is refused, never applied (D2414).
 */
export const MAX_DELIVERY_OFFERS_APPLIED = 1;

/**
 * Most offers one order can hold (D2427, D2445, D2451): every line at its line-offer bound, the order discounts and the
 * one delivery waiver, as the token's `o` lists them. An order usage naming more did not come from a stored order.
 */
export const MAX_ORDER_HELD_OFFERS =
  MAX_QUOTE_LINES * MAX_LINE_OFFERS_APPLIED + MAX_ORDER_DISCOUNTS_APPLIED + MAX_DELIVERY_OFFERS_APPLIED;
