/**
 * Where a product may be shown (D2109): store lists, search and collections; its own product page; a landing page;
 * the merchant's dashboard.
 */
export const VISIBILITY_CONTEXTS = ['listing', 'productPage', 'landingPage', 'admin'] as const;

/** The number of the first variant SKU: `<sku>-1`. */
export const FIRST_SKU_NUMBER = 1;

/** The smallest quantity a buyer can order when the product has no quantity rules. */
export const MIN_ORDER_QUANTITY = 1;
