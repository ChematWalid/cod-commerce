/** The states of a stored pack: priced from live components, or holding its last price while a component is gone. */
export const PACK_STATUSES = ['ok', 'stale'] as const;

/** Longest stored mode or status word; the longest today is `components_sum` (14). */
export const PACK_KIND_MAX_LENGTH = 16;

/** The key a pricing pipeline knows the pack resolver by (D2204). */
export const PACK_RESOLVER_KEY = 'pack';

/** The outbox consumer that recomputes packs when a product changes (D2203). */
export const PACK_RECOMPUTE_CONSUMER = 'catalog-packs-recompute';

/** The job queue its deliveries ride on (D2203). */
export const PACK_RECOMPUTE_QUEUE = 'integrations';

/** A whole percentage: 100 % is the full price. */
export const PERCENT_BASE = 100;

/** The product type catalog gives a pack (D2126, D2227). */
export const PACK_PRODUCT_TYPE = 'pack';

/** The product status that takes a product off sale, and a pack holding it out of pricing (D2203). */
export const DRAFT_STATUS = 'draft';
