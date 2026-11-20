import type { OfferTarget, ProductDiscountScope, TargetRefType } from '@cod/shared';
import type { PricedLine } from '../cart';
import { BUY_ROLES } from '../constants';
import type { Offer } from '../offer';

/** Whether a target of `refType` names `line`. */
type TargetMatcher = (line: PricedLine, refId: string) => boolean;

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
 * The lines the offer's buy targets name, in cart order (D2410). `coverage: 'all'` (a product discount on every
 * product) matches every line whatever the targets; the kind adapter decides it from its parsed config.
 */
export function matchingLines<Line extends PricedLine>(
  offer: Offer,
  lines: readonly Line[],
  coverage: ProductDiscountScope = 'targets',
): readonly Line[] {
  if (coverage === 'all') return lines;
  const buyTargets = offer.targets.filter((target) => BUY_ROLES.has(target.role));
  return lines.filter((line) => buyTargets.some(namesLine(line)));
}
