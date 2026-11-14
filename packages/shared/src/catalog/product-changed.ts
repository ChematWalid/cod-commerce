import type { Snowflake } from '../ids/snowflake';

/** What happened to a product in a `product.changed` outbox event (D2127). */
export const PRODUCT_CHANGE_KINDS = ['created', 'updated', 'status', 'deleted'] as const;

/** One of the {@link PRODUCT_CHANGE_KINDS}. */
export type ProductChangeKind = (typeof PRODUCT_CHANGE_KINDS)[number];

/**
 * The payload of a `product.changed` outbox event (D2127): ids and the kind of change, nothing else. The event's
 * `aggregateId` is the Vendure product id too; the store rides here because a business has several. Consumers (P2.S3
 * recompute, P3.S2 cache tags) read the product by id under their own tenant scope.
 */
export type ProductChangedPayload = {
  /** The Vendure product id, as a decimal string. */
  readonly productId: string;
  readonly storeId: Snowflake;
  readonly change: ProductChangeKind;
};
