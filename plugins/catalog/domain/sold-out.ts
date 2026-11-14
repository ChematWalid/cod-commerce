/** What decides whether a buyer may order a product (D2107, D2108). */
export interface SoldOutState {
  readonly soldOut: boolean;
  /** Orders stay open while the product is sold out; "stop orders" turns it off. */
  readonly allowOutOfStockOrders: boolean;
}

/** Whether a buyer may order the product: it is not sold out, or the merchant keeps taking orders for it. */
export const isOrderable = ({ soldOut, allowOutOfStockOrders }: SoldOutState): boolean =>
  !soldOut || allowOutOfStockOrders;

/** What "Stop orders" and "Resume orders" do to the sold-out products they name (D2108). */
export type SoldOutOrdersAction = 'stop' | 'resume';

/** The `allowOutOfStockOrders` a product holds after `action`. */
export const allowsOrdersAfter = (action: SoldOutOrdersAction): boolean => action === 'resume';
