import type { OfferStatus } from '@cod/shared';
import { InvalidOfferTransitionError } from './errors';
import type { OfferRecord } from './offer-record';

type Stamp = (offer: OfferRecord, now: Date) => Partial<OfferRecord>;

/** A named move of the lifecycle: the statuses it starts from, where it leads, and the instants it records. */
interface OfferMoveRule {
  readonly from: readonly OfferStatus[];
  readonly to: OfferStatus;
  readonly stamp: Stamp;
}

/**
 * The only ways an offer's status changes (D2510), each from fixed sources: `publish` is the only way out of `draft`
 * into `active`, and archived is final. The first publication stays the start of an offer without `startsAt` (D2419),
 * so resuming a paused offer keeps it.
 */
export const OFFER_MOVES = {
  publish: { from: ['draft'], to: 'active', stamp: (_offer, now) => ({ publishedAt: now, pausedAt: null }) },
  pause: { from: ['active'], to: 'paused', stamp: (_offer, now) => ({ pausedAt: now }) },
  resume: {
    from: ['paused'],
    to: 'active',
    stamp: (offer, now) => ({ publishedAt: offer.publishedAt ?? now, pausedAt: null }),
  },
  archive: { from: ['draft', 'active', 'paused'], to: 'archived', stamp: (_offer, now) => ({ archivedAt: now }) },
} as const satisfies Readonly<Record<string, OfferMoveRule>>;

/** One of the {@link OFFER_MOVES}. */
export type OfferMove = keyof typeof OFFER_MOVES;

/**
 * The move a raw status change stands for (the P2.S4 `setStatus` callers): reaching `active` is a resume, never a
 * publish, so a draft can only go live through `publish` and its checks (D2510).
 */
const MOVE_TO: Readonly<Record<OfferStatus, OfferMove | undefined>> = {
  draft: undefined,
  active: 'resume',
  paused: 'pause',
  archived: 'archive',
};

/** @throws {@link InvalidOfferTransitionError} when `offer` is archived: an archived offer is never edited again. */
export function assertEditable(offer: OfferRecord): void {
  if (offer.status === 'archived') throw new InvalidOfferTransitionError();
}

/** The move that reaches `status`; @throws {@link InvalidOfferTransitionError} for `draft`, which no move reaches. */
export function moveTo(status: OfferStatus): OfferMove {
  const move = MOVE_TO[status];
  if (move === undefined) throw new InvalidOfferTransitionError();
  return move;
}

/**
 * `offer` after `move` at `now`, with its version bumped.
 *
 * @throws {@link InvalidOfferTransitionError} when the offer's status is not one the move starts from.
 */
export function withMove(offer: OfferRecord, move: OfferMove, now: Date): OfferRecord {
  const rule: OfferMoveRule = OFFER_MOVES[move];
  if (!rule.from.includes(offer.status)) throw new InvalidOfferTransitionError();
  return { ...offer, ...rule.stamp(offer, now), status: rule.to, version: offer.version + 1, updatedAt: now };
}
