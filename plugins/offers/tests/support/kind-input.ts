import type { RunningLine } from '../../domain/cart';
import type { KindInput } from '../../domain/engine/outcome';
import { aLine, anOffer, UNRESOLVED_SHIPPING } from './builders';

/** A running line: {@link aLine} at `unitPrice`, which defaults to its original price (no line offer yet). */
export function aRunningLine(overrides: Partial<RunningLine> = {}): RunningLine {
  const line = aLine(overrides);
  return { ...line, unitPrice: overrides.unitPrice ?? line.originalPrice };
}

/** The pieces of `lines`: the sum of their quantities. */
const piecesOf = (lines: readonly RunningLine[]): number => lines.reduce((sum, line) => sum + line.quantity, 0);

/** The subtotal of `lines` at their running unit prices. */
const subtotalOf = (lines: readonly RunningLine[]): number =>
  lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

/**
 * What a calculator reads for `config` over `lines`: an offer targeting product 1 by default, bases computed from
 * the lines, an unresolved home delivery and no add-on.
 */
export function aKindInput<C>(
  config: C,
  lines: readonly RunningLine[],
  overrides: Partial<Omit<KindInput<C>, 'config' | 'lines'>> = {},
): KindInput<C> {
  return {
    offer: anOffer({ targets: [{ role: 'buy', refType: 'product', refId: '1' }] }),
    config,
    lines,
    base: { subtotal: subtotalOf(lines), pieces: piecesOf(lines) },
    delivery: { ...UNRESOLVED_SHIPPING, method: 'home' },
    addons: [],
    ...overrides,
  };
}
