import type { CombinationClass } from '@cod/shared';
import type { PricedLine, PricingCart, RunningLine } from '../cart';
import type { Offer } from '../offer';
import type { PricingSnapshot } from '../snapshot';
import type { OfferKindCalculator } from './kind-registry';
import type { DeliveryContext, KindInput, PricingBase } from './outcome';

/** What every stage of one quote reads: the cart, the snapshot and the delivery context. */
export interface PricingContext {
  readonly cart: PricingCart;
  readonly snapshot: PricingSnapshot;
  readonly delivery: DeliveryContext;
}

/** An offer the cart may get: its calculator, parsed config and the code that activated it, if any. */
export interface OfferEntry {
  readonly offer: Offer;
  readonly calculator: OfferKindCalculator<unknown>;
  readonly config: unknown;
  readonly code: string | null;
}

/** An eligible offer with an effect, ranked by its value to the buyer (D2411). */
export interface Candidate extends OfferEntry {
  readonly combinationClass: CombinationClass;
  readonly value: number;
  /** Keys of the lines the outcome discounts; empty for order and delivery outcomes. */
  readonly lineKeys: readonly string[];
}

/** The lines before any line offer: each at its original unit price. */
export function runningLinesOf(lines: readonly PricedLine[]): RunningLine[] {
  return lines.map((line) => ({ ...line, unitPrice: line.originalPrice }));
}

/** The base thresholds are measured on (D2412): subtotal at the running unit prices and the pieces. */
export function baseOf(lines: readonly RunningLine[]): PricingBase {
  return lines.reduce(
    (base, line) => ({ subtotal: base.subtotal + line.unitPrice * line.quantity, pieces: base.pieces + line.quantity }),
    { subtotal: 0, pieces: 0 },
  );
}

/** What the entry's calculator reads over `lines`. */
export function kindInputOf(
  entry: OfferEntry,
  lines: readonly RunningLine[],
  delivery: DeliveryContext,
): KindInput<unknown> {
  return { offer: entry.offer, config: entry.config, lines, base: baseOf(lines), delivery };
}
