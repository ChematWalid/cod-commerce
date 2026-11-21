/** The part of a cart line merging reads: its variant and quantity. */
export interface MergeableLine {
  readonly variantId: string;
  readonly quantity: number;
}

/**
 * The lines with one entry per variant, in first-seen order: the quantities of a variant are summed and its other
 * fields come from its first line (D2428). Tier counting and the cart hash both read the merged lines.
 */
export function mergeLines<Line extends MergeableLine>(lines: readonly Line[]): Line[] {
  const byVariant = new Map<string, Line>();
  for (const line of lines) {
    const seen = byVariant.get(line.variantId);
    byVariant.set(line.variantId, seen === undefined ? line : { ...seen, quantity: seen.quantity + line.quantity });
  }
  return [...byVariant.values()];
}
