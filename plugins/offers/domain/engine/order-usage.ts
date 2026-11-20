import type { Offer } from '../offer';
import type { CodeEntry, PricingSnapshot } from '../snapshot';
import { normaliseCode } from './codes';

/** The uses an existing order already holds: the offers applied to it and the codes it was placed with (D2427). */
export interface OrderUsage {
  readonly offerIds: readonly string[];
  readonly codes: readonly string[];
  /**
   * The buyer's orders placed before this one, as the order recorded them when it was created (D2442): the
   * `BuyerHistory` count read just before the order was inserted. It fixes the order's audience even after the buyer
   * orders again; omitted or null (not recorded), the order is taken to be the buyer's latest. It belongs to the order's
   * current phone: the caller stores `OrderFields.buyerOrdersBefore` after every saved change.
   */
  readonly buyerOrdersBefore?: number | null;
}

/**
 * What re-pricing a cart of an existing order gives back. `ownBuyer` holds when the cart keeps the order's own buyer
 * phone: only then do that buyer's per-offer uses and order count include this order.
 */
export interface OrderRelease extends OrderUsage {
  readonly ownBuyer: boolean;
}

const oneLess = (count: number): number => Math.max(0, count - 1);

function releaseOffers(offers: readonly Offer[], held: ReadonlySet<string>): readonly Offer[] {
  return offers.map((offer) => (held.has(offer.id) ? { ...offer, usageCount: oneLess(offer.usageCount) } : offer));
}

function releaseCodes(
  codes: ReadonlyMap<string, CodeEntry>,
  held: ReadonlySet<string>,
): ReadonlyMap<string, CodeEntry> {
  return new Map(
    [...codes].map(([code, entry]) => [
      code,
      held.has(code) ? { ...entry, usageCount: oneLess(entry.usageCount) } : entry,
    ]),
  );
}

function releasePerBuyer(usage: ReadonlyMap<string, number>, held: ReadonlySet<string>): ReadonlyMap<string, number> {
  const released = [...usage].flatMap(([offerId, count]): [string, number][] => {
    const left = held.has(offerId) ? oneLess(count) : count;
    return left === 0 ? [] : [[offerId, left]];
  });
  return new Map(released);
}

function ordersBefore(count: number | null, recorded: number | null | undefined): number | null {
  if (count === null) return null;
  return recorded ?? oneLess(count);
}

/**
 * The snapshot with the order's own uses given back, one per held offer and code, and, for the order's own buyer, one
 * per-buyer use of each held offer and the buyer's order count as it stood before the order (D2442). Re-pricing an
 * order must not let what it already made refuse it or change its audience: an order that took an offer's last allowed
 * use, or that was the buyer's first, keeps its offers on every edit (D2427, ADR 0004 agent upsell).
 */
export function releaseOrderUsage(snapshot: PricingSnapshot, release: OrderRelease): PricingSnapshot {
  const holdsNothing = release.offerIds.length === 0 && release.codes.length === 0;
  if (holdsNothing && (!release.ownBuyer || snapshot.buyerOrderCount === null)) return snapshot;
  const offerIds = new Set(release.offerIds);
  const codes = new Set(release.codes.map(normaliseCode));
  const buyer = release.ownBuyer
    ? {
        perBuyerUsage: releasePerBuyer(snapshot.perBuyerUsage, offerIds),
        buyerOrderCount: ordersBefore(snapshot.buyerOrderCount, release.buyerOrdersBefore),
      }
    : {};
  return {
    ...snapshot,
    offers: releaseOffers(snapshot.offers, offerIds),
    codes: releaseCodes(snapshot.codes, codes),
    ...buyer,
  };
}
