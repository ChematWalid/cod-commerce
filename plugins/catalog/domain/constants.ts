/**
 * Where a product may be shown (D2109): store lists, search and collections; its own product page; a landing page;
 * the merchant's dashboard.
 */
export const VISIBILITY_CONTEXTS = ['listing', 'productPage', 'landingPage', 'admin'] as const;

/**
 * What a store does with sold-out products: keep showing them flagged, or hide them from lists and product pages.
 * Mirrors tenancy's `SOLD_OUT_BEHAVIORS`, which the catalog domain may not import (§3a.2); the adapter reading the
 * store maps one onto the other.
 */
export const SOLD_OUT_BEHAVIORS = ['keep', 'hide'] as const;

/** The number of the first variant SKU: `<sku>-1`. */
export const FIRST_SKU_NUMBER = 1;

/** The smallest quantity a buyer can order when the product has no quantity rules. */
export const MIN_ORDER_QUANTITY = 1;
