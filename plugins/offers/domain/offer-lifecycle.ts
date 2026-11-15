import type { OfferStatus } from '@cod/shared';
import { InvalidOfferTransitionError } from './errors';
import type { OfferRecord } from './offer-record';

/** The statuses an offer may move to from each status; archived is final. */
const NEXT_STATUSES: Readonly<Record<OfferStatus, readonly OfferStatus[]>> = {
  draft: ['active', 'archived'],
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],
};

type Stamp = (offer: OfferRecord, now: Date) => Partial<OfferRecord>;

/**
 * The instants a move to each status records: the first publication stays the start of an offer without `startsAt`
 * (D2419), so resuming a paused offer keeps it.
 */
const STAMPS: Readonly<Record<OfferStatus, Stamp>> = {
  draft: () => ({}),
  active: (offer, now) => ({ publishedAt: offer.publishedAt ?? now, pausedAt: null }),
  paused: (_offer, now) => ({ pausedAt: now }),
  archived: (_offer, now) => ({ archivedAt: now }),
};

/** @throws {@link InvalidOfferTransitionError} when `offer` is archived: an archived offer is never edited again. */
export function assertEditable(offer: OfferRecord): void {
  if (offer.status === 'archived') throw new InvalidOfferTransitionError();
}

/**
 * `offer` moved to `status` at `now`, with its version bumped.
 *
 * @throws {@link InvalidOfferTransitionError} for a move {@link NEXT_STATUSES} does not allow.
 */
export function withStatus(offer: OfferRecord, status: OfferStatus, now: Date): OfferRecord {
  if (!NEXT_STATUSES[offer.status].includes(status)) throw new InvalidOfferTransitionError();
  return { ...offer, ...STAMPS[status](offer, now), status, version: offer.version + 1, updatedAt: now };
}
