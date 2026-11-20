import { MONEY_MAX_DZD, type DeliveryBlock, type OrderDiscount, type QuoteLine } from '@cod/shared';
import { PricingTotalTooLargeError } from '../errors';

/** What the totals read of the quote. */
export interface TotalsInput {
  readonly lines: readonly Pick<QuoteLine, 'originalPrice' | 'quantity' | 'totalPrice'>[];
  readonly discounts: readonly Pick<OrderDiscount, 'amount'>[];
  readonly delivery: DeliveryBlock;
}

/** The amounts of a quote (D2415). */
export interface Totals {
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly total: number;
  readonly savings: number;
}

const sum = (amounts: readonly number[]): number => amounts.reduce((total, amount) => total + amount, 0);

/**
 * Totals per ADR 0004 (D2415): the subtotal of line totals, order-level discounts only in `discountTotal`,
 * `total = subtotal − discountTotal + delivery.price`, and savings of line discounts, order discounts and the waived
 * fee.
 *
 * @throws {@link PricingTotalTooLargeError} when the subtotal or total leaves the money range.
 */
export function totalsOf({ lines, discounts, delivery }: TotalsInput): Totals {
  const subtotal = sum(lines.map((line) => line.totalPrice));
  const discountTotal = sum(discounts.map((discount) => discount.amount));
  const total = subtotal - discountTotal + delivery.price;
  if (subtotal > MONEY_MAX_DZD || total > MONEY_MAX_DZD) throw new PricingTotalTooLargeError();
  const lineSavings = sum(lines.map((line) => line.originalPrice * line.quantity - line.totalPrice));
  const waivedFee = delivery.waived ? delivery.fee + delivery.overweightFee : 0;
  return { subtotal, discountTotal, total, savings: lineSavings + discountTotal + waivedFee };
}
