import type { RunningLine } from '../cart';
import type { LineOutcome } from '../engine/outcome';

/** What a line kind gives one line: its key and the discount per unit. */
export interface UnitDiscount {
  readonly line: RunningLine;
  readonly perUnit: number;
}

/**
 * The line outcome of per-unit discounts; `value` is the line saving plus `waivedFee` when the offer also waives
 * delivery (D2411). No discount at all is an outcome of value 0, which the pipeline neither applies nor reports.
 */
export function lineOutcome(discounts: readonly UnitDiscount[], waivedFee: number | null): LineOutcome {
  const unitDiscounts = new Map(discounts.map(({ line, perUnit }) => [line.key, perUnit]));
  const lineSaving = discounts.reduce((sum, { line, perUnit }) => sum + perUnit * line.quantity, 0);
  return {
    kind: 'line',
    unitDiscounts,
    value: lineSaving + (waivedFee ?? 0),
    freeDelivery: waivedFee !== null,
  };
}
