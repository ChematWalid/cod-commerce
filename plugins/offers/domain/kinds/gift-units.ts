import type { RunningLine } from '../cart';
import { compareOfferIds } from '../engine/combine';

/** What `giftUnits` reads: the lines gifts may come from and how many units to gift. */
export interface GiftUnitsInput {
  readonly lines: readonly RunningLine[];
  readonly units: number;
}

/** Cheapest running unit price first, then variant id ascending by number (D2504). */
const byGiftOrder = (left: RunningLine, right: RunningLine): number =>
  left.unitPrice - right.unitPrice || compareOfferIds(left.variantId, right.variantId);

/**
 * The units to gift from each line, by line key (D2504): the cheapest units first, ties by variant id, never more than
 * a line holds; fewer than `units` in all when the lines hold fewer.
 */
export function giftUnits({ lines, units }: GiftUnitsInput): ReadonlyMap<string, number> {
  const gifts = new Map<string, number>();
  let left = units;
  for (const line of [...lines].sort(byGiftOrder)) {
    if (left <= 0) break;
    const taken = Math.min(left, line.quantity);
    gifts.set(line.key, taken);
    left -= taken;
  }
  return gifts;
}
