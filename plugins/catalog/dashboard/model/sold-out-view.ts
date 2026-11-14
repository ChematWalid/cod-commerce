import type { ProductListTab } from '@cod/shared';
import { EDIT_PRODUCTS_KEY } from '../constants';

/** The catalogue ids of the marks a sold-out product carries in the list. */
export const SOLD_OUT_LABEL_ID = 'catalog.sold-out';
export const ORDERS_STOPPED_LABEL_ID = 'catalog.orders-stopped';

/** What the list knows of a product's sold-out state. */
export interface SoldOutMarks {
  readonly soldOut: boolean;
  readonly allowOutOfStockOrders: boolean;
}

/**
 * The marks of a row: "Sold out" for a sold-out product, plus "Orders stopped" once its orders are stopped (D2108). A
 * product in stock carries none, whatever its stopped flag says: the flag only matters while it is sold out.
 */
export function soldOutBadgesOf({ soldOut, allowOutOfStockOrders }: SoldOutMarks): readonly string[] {
  if (!soldOut) return [];
  return allowOutOfStockOrders ? [SOLD_OUT_LABEL_ID] : [SOLD_OUT_LABEL_ID, ORDERS_STOPPED_LABEL_ID];
}

/** Whether the list offers "Stop orders" and "Resume orders": on the sold-out tab, to a caller who may edit. */
export const soldOutOrdersOffered = (tab: ProductListTab, held: ReadonlySet<string>): boolean =>
  tab === 'sold-out' && held.has(EDIT_PRODUCTS_KEY);
