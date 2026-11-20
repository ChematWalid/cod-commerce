import type { OfferTarget, OfferTargetRole, ProductDiscountScope, TargetRefType } from '@cod/shared';
import type { PricedLine } from '../cart';
import { BUY_ROLES } from '../constants';
import type { Offer } from '../offer';

/** Whether a target of `refType` names `line`. */
type TargetMatcher = (line: PricedLine, refId: string) => boolean;

/** A line an offer may read: a priced line, or a running one that may be a gift (D2504) or add-on line (D2506). */
type TargetableLine = PricedLine & { readonly giftOf?: string; readonly addonOf?: string };

/**
 * One matcher per target type (§3a.7): a collection target matches a line of a product in that collection.
 * A Map, not an object literal: `refType` comes from a varchar column (D2405), and an unknown value such as
 * `constructor` must find no matcher instead of an inherited Object.prototype member.
 */
const MATCHERS: ReadonlyMap<string, TargetMatcher> = new Map<TargetRefType, TargetMatcher>([
  ['variant', (line, refId) => line.variantId === refId],
  ['product', (line, refId) => line.productId === refId],
  ['collection', (line, refId) => line.collectionIds.includes(refId)],
]);

/** A target of an unknown `refType` names no line. */
const namesLine = (line: PricedLine) => (target: Readonly<OfferTarget>) =>
  MATCHERS.get(target.refType)?.(line, target.refId) ?? false;

/**
 * The lines the buyer bought at their own price: a gift line carries no later line offer (D2504), and an add-on line
 * is priced by its add-on offer alone (D2506).
 */
const paidLines = <Line extends TargetableLine>(lines: readonly Line[]): readonly Line[] =>
  lines.filter((line) => line.giftOf === undefined && line.addonOf === undefined);

/** The lines the offer's targets of one of `roles` name, gift and add-on lines left out, in cart order. */
function linesNamedBy<Line extends TargetableLine>(
  offer: Offer,
  lines: readonly Line[],
  roles: ReadonlySet<string>,
): readonly Line[] {
  const targets = offer.targets.filter((target) => roles.has(target.role));
  return paidLines(lines).filter((line) => targets.some(namesLine(line)));
}

/**
 * The lines the offer's buy targets name, in cart order (D2410). `coverage: 'all'` (a product discount on every
 * product) matches every line whatever the targets; the kind adapter decides it from its parsed config. Gift and
 * add-on lines never match (D2504, D2506).
 */
export function matchingLines<Line extends TargetableLine>(
  offer: Offer,
  lines: readonly Line[],
  coverage: ProductDiscountScope = 'targets',
): readonly Line[] {
  if (coverage === 'all') return paidLines(lines);
  return linesNamedBy(offer, lines, BUY_ROLES);
}

/** The lines the offer's targets of `role` name, gift and add-on lines left out, in cart order (bxgy `get` lines). */
export function matchingLinesByRole<Line extends TargetableLine>(
  offer: Offer,
  lines: readonly Line[],
  role: OfferTargetRole,
): readonly Line[] {
  return linesNamedBy(offer, lines, new Set([role]));
}
