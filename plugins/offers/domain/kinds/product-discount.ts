import {
  percentOf,
  productDiscountConfigSchema,
  STAGE_PRODUCT_DISCOUNT,
  type DiscountValueType,
  type ProductDiscountConfig,
  type ProductDiscountScope,
} from '@cod/shared';
import type { OfferKindCalculator, TargetRules } from '../engine/kind-registry';
import type { KindInput, OfferOutcome } from '../engine/outcome';
import { matchingLines } from '../engine/targets';
import { lineOutcome } from './line-outcome';
import { BUY_TARGET_OPTIONAL, BUY_TARGET_REQUIRED } from './target-rules';

/** Buy targets are needed only when the discount applies to them, not to every product (D2501). */
const TARGET_RULES_BY_SCOPE: Readonly<Record<ProductDiscountScope, TargetRules>> = {
  all: BUY_TARGET_OPTIONAL,
  targets: BUY_TARGET_REQUIRED,
};

/** The raw discount of one unit at `unitPrice`, by value type (§3a.7): percent half up, or fixed DZD (D2409). */
const RAW_UNIT_DISCOUNTS: Readonly<Record<DiscountValueType, (value: number, unitPrice: number) => number>> = {
  percent: (value, unitPrice) => percentOf(unitPrice, value),
  fixed: (value) => value,
};

/** The discount of one unit: raw, then capped, then at most the unit price so a unit never goes below 0. */
function unitDiscount(config: ProductDiscountConfig, unitPrice: number): number {
  const raw = RAW_UNIT_DISCOUNTS[config.valueType](config.value, unitPrice);
  const capped = config.cap === null ? raw : Math.min(raw, config.cap);
  return Math.min(capped, unitPrice);
}

/** A product discount on every unit of the targeted lines, or of every line with `appliesTo: 'all'`. */
function evaluateProductDiscount(input: KindInput<ProductDiscountConfig>): OfferOutcome {
  const { config } = input;
  const lines = matchingLines(input.offer, input.lines, config.appliesTo);
  return lineOutcome(
    lines.map((line) => ({ line, perUnit: unitDiscount(config, line.unitPrice) })),
    null,
  );
}

/** The `product_discount` kind: percent or fixed off each unit, on the running unit price (D2411). */
export const productDiscountCalculator: OfferKindCalculator<ProductDiscountConfig> = {
  kind: 'product_discount',
  combinationClass: 'product',
  stage: STAGE_PRODUCT_DISCOUNT,
  configSchema: productDiscountConfigSchema,
  evaluate: evaluateProductDiscount,
  targetRules: (config) => TARGET_RULES_BY_SCOPE[config.appliesTo],
};
