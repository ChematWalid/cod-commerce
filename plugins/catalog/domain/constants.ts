import { BRAND_NAME_MAX, type ProductStatus, type ProductType, TAG_NAME_MAX } from '@cod/shared';

/**
 * Where a product may be shown (D2109): store lists, search and collections; its own product page; a landing page;
 * the merchant's dashboard.
 */
export const VISIBILITY_CONTEXTS = ['listing', 'productPage', 'landingPage', 'admin'] as const;

/** The number of the first variant SKU: `<sku>-1`. */
export const FIRST_SKU_NUMBER = 1;

/** The smallest quantity a buyer can order when the product has no quantity rules. */
export const MIN_ORDER_QUANTITY = 1;

/** The status of a product saved without one: never public until the merchant says so (D2109). */
export const DEFAULT_PRODUCT_STATUS: ProductStatus = 'draft';

/** The type of a product saved without one (D2126). */
export const DEFAULT_PRODUCT_TYPE: ProductType = 'physical';

/** Longest stored status or type word; the longest today is `physical`. */
export const SHORT_KIND_MAX_LENGTH = 16;

/** Longest decimal snowflake: 2^63 − 1 has 19 digits; one more keeps the column the size of tenancy's (ADR 0003). */
export const SNOWFLAKE_TEXT_LENGTH = 20;

/**
 * How much longer a name key may be than its name: lower-casing and NFC can turn one character into several (e.g.
 * "İ" lower-cases to two code points), and the key must never be cut.
 */
const NAME_KEY_GROWTH = 4;

/** Longest stored key of a brand and of a tag name (D2140). */
export const BRAND_NAME_KEY_MAX = BRAND_NAME_MAX * NAME_KEY_GROWTH;
export const TAG_NAME_KEY_MAX = TAG_NAME_MAX * NAME_KEY_GROWTH;
