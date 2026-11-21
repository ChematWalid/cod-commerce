import type { RejectedCode } from '@cod/shared';
import { CODES_METHOD } from '../constants';
import type { Offer } from '../offer';
import type { PricingSnapshot } from '../snapshot';

/** The codes a cart activated and the ones it could not use, before any offer is evaluated. */
export interface CodeResolution {
  /** Normalised code by the offer id it activates; one code per offer (once per order, AC4). */
  readonly activated: ReadonlyMap<string, string>;
  readonly rejected: readonly RejectedCode[];
}

/** A code as stored: trimmed and upper-cased (D2406), so `' influ10 '` reads `INFLU10`. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

type CodeCheck = (
  code: string,
  snapshot: PricingSnapshot,
  activated: ReadonlyMap<string, string>,
) => RejectedCode['reason'] | null;

/** The code's offer when it is priced now: only active offers enter the snapshot (D2419). */
const activeOfferOf = (offerId: string, snapshot: PricingSnapshot): Offer | undefined =>
  snapshot.offers.find((offer) => offer.id === offerId && offer.status === 'active');

/**
 * Why the store refuses `code` before its offer is evaluated, or `null` when it activates its offer. A code of an
 * automatic offer activates nothing (D2449): it is `not_found`, so it is never recorded as a code use.
 */
const checkCode: CodeCheck = (code, snapshot, activated) => {
  const entry = snapshot.codes.get(code);
  if (entry === undefined) return 'not_found';
  const offer = activeOfferOf(entry.offerId, snapshot);
  if (offer === undefined) return 'inactive';
  if (offer.method !== CODES_METHOD) return 'not_found';
  if (entry.usageLimit !== null && entry.usageCount >= entry.usageLimit) return 'code_limit';
  return activated.has(entry.offerId) ? 'duplicate' : null;
};

/**
 * Reads the typed codes in order (D2406, D2417): each is normalised; a repeat, or a second code of an offer already
 * activated, is a `duplicate`; an unknown one, or one of an automatic offer, `not_found`; one of an offer not active
 * `inactive`; one past its own limit `code_limit`. The rest activate their offer, whose eligibility and effect the
 * pipeline then checks.
 */
export function resolveCodes(codes: readonly string[], snapshot: PricingSnapshot): CodeResolution {
  const activated = new Map<string, string>();
  const rejected: RejectedCode[] = [];
  const seen = new Set<string>();
  for (const code of codes.map(normaliseCode)) {
    const reason = seen.has(code) ? 'duplicate' : checkCode(code, snapshot, activated);
    seen.add(code);
    const offerId = snapshot.codes.get(code)?.offerId;
    if (reason === null && offerId !== undefined) activated.set(offerId, code);
    else if (reason !== null) rejected.push({ code, reason });
  }
  return { activated, rejected };
}
