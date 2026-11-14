import type { FreeDeliverySuggestion, Threshold } from '@cod/shared';
import type { PricingBase } from '../engine/outcome';

/** What a cart still lacks to reach a threshold: some pieces or some DZD of subtotal. */
export type ThresholdShortfall = FreeDeliverySuggestion['missing'];

type ThresholdOf<T extends Threshold['type']> = Extract<Threshold, { type: T }>;

/**
 * The shortfall of `base` below each threshold type, or `null` once it is reached (§3a.7: a new threshold type is a
 * new entry here). Both are measured on the base after line offers (D2412).
 */
const SHORTFALLS: {
  readonly [T in Threshold['type']]: (threshold: ThresholdOf<T>, base: PricingBase) => ThresholdShortfall | null;
} = {
  none: () => null,
  pieces: ({ min }, { pieces }) => (pieces >= min ? null : { pieces: min - pieces }),
  amount: ({ min }, { subtotal }) => (subtotal >= min ? null : { amount: min - subtotal }),
};

/** What `base` still lacks to reach `threshold`, or `null` when it is reached. */
export function shortfallOf(threshold: Threshold, base: PricingBase): ThresholdShortfall | null {
  const shortfall = SHORTFALLS[threshold.type] as (
    threshold: Threshold,
    base: PricingBase,
  ) => ThresholdShortfall | null;
  return shortfall(threshold, base);
}
