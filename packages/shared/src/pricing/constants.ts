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
/** Longest token `verifyQuote` reads; a longer one is malformed before any decoding (D2421). */
export const MAX_QUOTE_TOKEN_LENGTH = 4096;
/** Domain label of the keyed phone hash inside the cart hash (D2421). */
export const QUOTE_PHONE_KEY_LABEL = 'qt1-phone:';

/** Request bounds (D2429). */
export const MAX_QUOTE_LINES = 50;
export const MAX_LINE_QUANTITY = 999;
export const MAX_QUOTE_CODES = 5;
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

/** Pipeline stages, applied in ascending order (D2411, D2412). */
export const STAGE_QUANTITY = 10;
export const STAGE_PRODUCT_DISCOUNT = 20;
export const STAGE_ORDER = 30;
export const STAGE_DELIVERY = 40;
