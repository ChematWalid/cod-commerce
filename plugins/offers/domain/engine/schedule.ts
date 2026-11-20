import type { Offer } from '../offer';

/** Why an offer is outside its schedule. */
export type ScheduleMiss = 'not_started' | 'ended';

/**
 * Whether `now` is inside the offer's schedule (D2419): active from `startsAt` (or `publishedAt` when no start is
 * set) inclusive to `endsAt` exclusive; no end means open. An offer with neither start nor publication instant has
 * no lower bound: only `active` offers reach the engine, and publishing sets `publishedAt`.
 *
 * @returns `null` when in schedule, else the reason.
 */
export function isInSchedule(offer: Offer, now: Date): ScheduleMiss | null {
  const start = offer.startsAt ?? offer.publishedAt;
  if (start !== null && now.getTime() < start.getTime()) return 'not_started';
  if (offer.endsAt !== null && now.getTime() >= offer.endsAt.getTime()) return 'ended';
  return null;
}
