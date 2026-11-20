import type { LineDiscount, QuoteLine } from '@cod/shared';
import type { RunningLine } from '../cart';
import type { LineOutcome } from './outcome';
import type { TokenLine } from './priced-quote';

/** The discounts each line got, by line key, in the order they applied. */
export type LineDiscounts = ReadonlyMap<string, readonly LineDiscount[]>;

/** What applying one line outcome gives: the new running lines, the discounts and the line saving. */
export interface AppliedLineOutcome {
  readonly lines: readonly RunningLine[];
  readonly lineDiscounts: LineDiscounts;
  readonly saving: number;
}

/** What `applyLineOutcome` reads. */
export interface LineOutcomeInput {
  readonly lines: readonly RunningLine[];
  readonly lineDiscounts: LineDiscounts;
  readonly outcome: LineOutcome;
  /** The offer the discount is reported under. */
  readonly source: Omit<LineDiscount, 'amount'>;
}

/** The per-unit discount actually taken from `line`: never negative, never more than its running unit price. */
const takenFrom = (line: RunningLine, outcome: LineOutcome): number =>
  Math.min(Math.max(outcome.unitDiscounts.get(line.key) ?? 0, 0), line.unitPrice);

/**
 * Takes the outcome's per-unit discounts off the running unit prices (D2411: an accepted line offer stacks on the
 * price earlier stages reached) and records each non-zero one as a line discount for the whole line.
 */
export function applyLineOutcome({ lines, lineDiscounts, outcome, source }: LineOutcomeInput): AppliedLineOutcome {
  const discounts = new Map(lineDiscounts);
  const taken = lines.map((line) => ({ line, perUnit: takenFrom(line, outcome) }));
  for (const { line, perUnit } of taken) {
    if (perUnit === 0) continue;
    discounts.set(line.key, [...(discounts.get(line.key) ?? []), { ...source, amount: perUnit * line.quantity }]);
  }
  return {
    lines: taken.map(({ line, perUnit }) => ({ ...line, unitPrice: line.unitPrice - perUnit })),
    lineDiscounts: discounts,
    saving: taken.reduce((sum, { line, perUnit }) => sum + perUnit * line.quantity, 0),
  };
}

/** The quote lines: `totalPrice = unitPrice × quantity` always (D2409). */
export function quoteLinesOf(lines: readonly RunningLine[], lineDiscounts: LineDiscounts): QuoteLine[] {
  return lines.map((line) => ({
    key: line.key,
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    originalPrice: line.originalPrice,
    unitPrice: line.unitPrice,
    totalPrice: line.unitPrice * line.quantity,
    discounts: [...(lineDiscounts.get(line.key) ?? [])],
  }));
}

/** The lines as the token signs them (ADR 0004 `l`). */
export function tokenLinesOf(lines: readonly QuoteLine[]): TokenLine[] {
  return lines.map((line) => ({
    variantId: line.variantId,
    qty: line.quantity,
    unitPrice: line.unitPrice,
    originalPrice: line.originalPrice,
    offerIds: line.discounts.map((discount) => discount.offerId),
  }));
}
