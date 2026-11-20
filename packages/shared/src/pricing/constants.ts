import { INT_COLUMN_MAX } from '../catalog/constants';

/** Percentages are stored as whole numbers of this base: 10 means 10 %. */
export const PERCENT_BASE = 100;

/** Life of a signed quote: 15 minutes (ADR 0004). */
export const QUOTE_TTL_SECONDS = 900;
/** Version field `v` of the quote token payload. */
export const QUOTE_TOKEN_VERSION = 1;
/** First part of every quote token: `qt1.<payload>.<signature>`. */
export const QUOTE_TOKEN_PREFIX = 'qt1';
/** Random bytes of the token nonce `n`. */
export const QUOTE_NONCE_BYTES = 12;
/**
 * Longest token `signQuote` issues and `verifyQuote` reads; a longer one is malformed before any decoding (D2421).
 * Sized for the worst quote the request and stacking bounds allow (D2429): `MAX_QUOTE_LINES` lines with the widest
 * ids, quantities and prices and `MAX_LINE_OFFERS_APPLIED` offers each, plus `MAX_ORDER_DISCOUNTS_APPLIED` order
 * discounts, is about 13 KB.
 */
export const MAX_QUOTE_TOKEN_LENGTH = 16_384;
/** Domain label of the keyed phone hash inside the cart hash (D2421). */
export const QUOTE_PHONE_KEY_LABEL = 'qt1-phone:';

/** Request bounds (D2429). */
export const MAX_QUOTE_LINES = 50;
export const MAX_LINE_QUANTITY = 999;
export const MAX_QUOTE_CODES = 5;
/**
 * Stacking bounds (D2411): most product-class (line) offers one line carries and most order discounts one quote
 * applies, so the signed token has a worst case. A further combinable candidate that would overfill a line or the
 * quote is refused `not_combinable`.
 */
export const MAX_LINE_OFFERS_APPLIED = 4;
export const MAX_ORDER_DISCOUNTS_APPLIED = MAX_QUOTE_CODES + 3;
/** Most codes one admin add may carry, so one call never holds a transaction for an unbounded batch. */
export const MAX_CODES_PER_ADD = 100;
/** Longest code a buyer may type, before trimming and upper-casing. */
export const MAX_CODE_INPUT_LENGTH = 64;
/** Longest phone text a request may carry, before normalising. */
export const MAX_PHONE_INPUT_LENGTH = 32;
/** Longest commune (ONS) code of a destination. */
export const TOWN_ONS_MAX_LENGTH = 16;
/**
 * Longest id a pricing body may carry. Line variant ids and offer target ids are Vendure core ids, a Postgres
 * `integer` (SERIAL), so at most the digits of `INT_COLUMN_MAX`; they are never snowflakes.
 */
export const PRICING_ID_MAX_LENGTH = String(INT_COLUMN_MAX).length;
/** A row id as a positive decimal without leading zeros, so one variant has exactly one spelling (D2428). */
export const PRICING_ID_PATTERN = /^[1-9]\d*$/;
/** Algeria's country code, read when a buyer types it without the leading `+` (D2418). */
export const ALGERIA_COUNTRY_CODE = '213';

/** Stored discount codes: trimmed, upper-cased, 3 to 32 of `[A-Z0-9_-]` (D2406). */
export const CODE_MIN_LENGTH = 3;
export const CODE_MAX_LENGTH = 32;
export const CODE_PATTERN = /^[A-Z0-9_-]+$/;

/** Most tiers of one quantity offer. */
export const MAX_TIERS = 10;
/** Longest offer title and localized label. */
export const OFFER_TITLE_MAX = 120;
export const OFFER_LABEL_MAX = 120;
/** Longest offer kind key, and its spelling (a registry key, never a database enum, D2404). */
export const KIND_MAX_LENGTH = 64;
export const KIND_PATTERN = /^[a-z0-9_]+$/;
/** Most targets of one offer. */
export const MAX_OFFER_TARGETS = 100;

/** Pipeline stages, applied in ascending order (D2411, D2412, D2503, D2505). */
export const STAGE_QUANTITY = 10;
export const STAGE_BXGY = 15;
export const STAGE_PRODUCT_DISCOUNT = 20;
export const STAGE_ADDON = 25;
export const STAGE_ORDER = 30;
export const STAGE_DELIVERY = 40;

/** Most units one buy-x-get-y step buys or gifts, and most times it applies to one order (D2503). */
export const MAX_BXGY_QUANTITY = 20;
export const MAX_BXGY_TIMES = 50;
/** Most add-on targets of one offer, and most pieces of one add-on per order (D2505). */
export const MAX_ADDON_PRODUCTS = 5;
export const MAX_ADDON_PIECES = 10;
/** Most add-ons one quote request may carry (D2506). */
export const MAX_QUOTE_ADDONS = 5;

/** Admin offer list page size: the default and the largest page (D2513). */
export const OFFER_PAGE_SIZE = 20;
export const OFFER_PAGE_MAX = 50;

/** Generated codes (D2512): an optional upper-case prefix, then a random part without look-alike characters. */
export const GENERATED_CODE_LENGTH = 8;
export const GENERATED_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const GENERATED_CODE_PREFIX_MAX = 8;
export const GENERATED_CODE_PREFIX_PATTERN = /^[A-Z0-9]*$/;
/** Draws of a generated batch before a collision with stored codes gives up (D2512). */
export const GENERATE_CODE_ROUNDS = 3;

/** Defaults of an offer preview: a sample unit price and delivery fee in DZD (D2516). */
export const PREVIEW_SAMPLE_PRICE = 4900;
export const PREVIEW_DELIVERY_FEE = 800;
