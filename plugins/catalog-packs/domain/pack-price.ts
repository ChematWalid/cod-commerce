import { PERCENT_BASE } from './constants';
import type { PackPricing } from './pack';

/** A component line as pricing sees it: its unit price in whole DZD and its quantity. */
export interface PricedComponent {
  readonly unitPrice: number;
  readonly quantity: number;
}

/** Σ unit price × quantity: the components' price before any discount. */
export const componentsSum = (components: readonly PricedComponent[]): number =>
  components.reduce((sum, component) => sum + component.unitPrice * component.quantity, 0);

/**
 * `sum × (100 − percent) / 100`, rounded half-up to whole DZD. The product stays an integer below 2^53 (10 × 99 ×
 * int max × 100), and `x.5` is exact in a double, so `Math.round` (half-up for non-negative numbers) is exact.
 */
function afterPercent(sum: number, percent: number): number {
  return Math.round((sum * (PERCENT_BASE - percent)) / PERCENT_BASE);
}

/**
 * The price of a pack in whole DZD (D2202): `fixed` answers its fixed price; `components_sum` the components' sum
 * less the discount (a percentage rounded half-up, or an amount), never below 0.
 */
export function packPrice(pack: PackPricing, components: readonly PricedComponent[]): number {
  if (pack.packPricingMode === 'fixed') return pack.packFixedPrice ?? 0;
  const sum = componentsSum(components);
  const discount = pack.packDiscountValue ?? 0;
  if (pack.packDiscountType === 'percent') return Math.max(0, afterPercent(sum, discount));
  if (pack.packDiscountType === 'amount') return Math.max(0, sum - discount);
  return sum;
}
