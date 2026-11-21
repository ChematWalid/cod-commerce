import {
  orderDiscountConfigSchema,
  percentOf,
  STAGE_ORDER,
  type DiscountValueType,
  type OrderDiscountConfig,
} from '@cod/shared';
import type { OfferKindCalculator } from '../engine/kind-registry';
import type { KindInput, OfferOutcome } from '../engine/outcome';
import { BUY_TARGET_OPTIONAL } from './target-rules';
import { shortfallOf } from './threshold';

/** The raw discount on the order base, by value type (§3a.7): percent half up, or fixed DZD (D2409). */
const RAW_ORDER_DISCOUNTS: Readonly<Record<DiscountValueType, (value: number, subtotal: number) => number>> = {
  percent: (value, subtotal) => percentOf(subtotal, value),
  fixed: (value) => value,
};

/** The discount on `subtotal`: raw half up, then capped, then at most the subtotal (D2409, Review Focus 3). */
function orderDiscount(config: OrderDiscountConfig, subtotal: number): number {
  const raw = RAW_ORDER_DISCOUNTS[config.valueType](config.value, subtotal);
  const capped = config.cap === null ? raw : Math.min(raw, config.cap);
  return Math.min(capped, subtotal);
}

/** An order discount on the subtotal after line offers, once its minimum is reached (D2412). */
function evaluateOrderDiscount(input: KindInput<OrderDiscountConfig>): OfferOutcome {
  const { config, base } = input;
  if (shortfallOf(config.minimum, base) !== null) return { kind: 'skip', reason: 'min_not_met' };
  const amount = orderDiscount(config, base.subtotal);
  return { kind: 'order', amount, value: amount };
}

/** The `order_discount` kind: percent or fixed off the order, capped and never above the subtotal. */
export const orderDiscountCalculator: OfferKindCalculator<OrderDiscountConfig> = {
  kind: 'order_discount',
  combinationClass: 'order',
  stage: STAGE_ORDER,
  configSchema: orderDiscountConfigSchema,
  evaluate: evaluateOrderDiscount,
  targetRules: () => BUY_TARGET_OPTIONAL,
};
