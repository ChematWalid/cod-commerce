import type { OutboxDelivery } from '@cod/plugin-platform-outbox';
import { isSnowflake, PRODUCT_CHANGE_KINDS } from '@cod/shared';
import { z } from 'zod';
import { canonicalCoreId } from '../domain/core-id';

/** The `product.changed` payload (D2127) as the storefront consumers trust it: ids only, each well formed. */
export const productChangedSchema = z.object({
  productId: z.string().refine((id) => canonicalCoreId(id) !== undefined),
  storeId: z.string().refine(isSnowflake),
  change: z.enum(PRODUCT_CHANGE_KINDS),
});

/** The payload's store must be the delivery row's, when the row names one: anything else is a forged delivery. */
export const isRowStore = (delivery: OutboxDelivery, storeId: string): boolean =>
  delivery.storeId === null || delivery.storeId === storeId;

/**
 * The delivery row names a store and it is the payload's. A product or collection row always carries its store
 * (the catalog and collection producers write it), so a row without one cannot vouch for the payload's store id.
 */
export const isNamedRowStore = (delivery: OutboxDelivery, storeId: string): boolean =>
  delivery.storeId !== null && delivery.storeId === storeId;
