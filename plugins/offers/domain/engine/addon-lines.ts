import type { AddonPlacement, AddonRejectReason, RejectedAddon } from '@cod/shared';
import { addonLineKey, type AddonItem, type CartAddon, type PricingCart, type RunningLine } from '../cart';
import type { Offer } from '../offer';
import { assessOffers, type Assessment } from './candidates';
import type { OfferEntry, PricingContext } from './pricing-state';
import { mergeRefusals, NO_REFUSALS } from './refusals';
import { settle } from './settle';
import { matchingLinesByRole } from './targets';

/** The add-ons of a cart sorted out against the store's offers before any is priced (D2506). */
export interface AddonRequests {
  /** The add-ons each offer may price, by offer id, in request order. */
  readonly byOffer: ReadonlyMap<string, readonly AddonItem[]>;
  /** The reason of each add-on refused before pricing, by its add-on line key. */
  readonly refused: ReadonlyMap<string, AddonRejectReason>;
}

/** Whether `offer` offers the add-on's variant: one of its `addon` targets names it (D2505). */
function offersVariant(offer: Offer, item: AddonItem): boolean {
  const line = { ...item, key: item.variantId };
  return matchingLinesByRole(offer, [line], 'addon').length > 0;
}

/**
 * The add-on an offer may price, or why it is refused (D2506): `not_offered` when no entry of the cart offers add-ons
 * on this placement under that id (another store's offer is never in the snapshot) or none of its add-on targets
 * names the variant, `unavailable` when the gate refused the variant.
 */
function sortAddon(
  addon: CartAddon,
  entry: OfferEntry | undefined,
  placement: AddonPlacement,
): AddonItem | AddonRejectReason {
  if (entry === undefined || entry.calculator.addonPlacement?.(entry.config) !== placement) return 'not_offered';
  if (addon.priced === null) return 'unavailable';
  const item: AddonItem = { variantId: addon.variantId, quantity: addon.quantity, ...addon.priced };
  return offersVariant(entry.offer, item) ? item : 'not_offered';
}

/** The cart's add-ons sorted against the entries the cart may get (active offers, code offers once activated). */
export function addonRequestsOf(entries: readonly OfferEntry[], cart: PricingCart): AddonRequests {
  const entryById = new Map(entries.map((entry) => [entry.offer.id, entry]));
  const byOffer = new Map<string, AddonItem[]>();
  const refused = new Map<string, AddonRejectReason>();
  for (const addon of cart.addons) {
    const sorted = sortAddon(addon, entryById.get(addon.offerId), cart.addonPlacement);
    if (typeof sorted === 'string') refused.set(addonLineKey(addon.variantId, addon.offerId), sorted);
    else byOffer.set(addon.offerId, [...(byOffer.get(addon.offerId) ?? []), sorted]);
  }
  return { byOffer, refused };
}

/** The entries with the add-ons each one may price. */
export function withAddons(entries: readonly OfferEntry[], requests: AddonRequests): OfferEntry[] {
  return entries.map((entry) => {
    const addons = requests.byOffer.get(entry.offer.id);
    return addons === undefined ? entry : { ...entry, addons };
  });
}

const combinesAlways = (entry: OfferEntry): boolean => entry.calculator.combinesAlways === true;

/**
 * Assesses the entries in two steps (D2507): the offers that always combine (add-ons the buyer chose) on the lines
 * before offers, then every other offer on those lines plus the add-on lines, so an order minimum or a delivery
 * threshold counts the add-ons from the start, as it does once they are applied.
 */
export function assessWithAddons(
  entries: readonly OfferEntry[],
  lines: readonly RunningLine[],
  context: PricingContext,
): Assessment {
  const first = assessOffers(entries.filter(combinesAlways), lines, context);
  const delivery = context.delivery;
  const withAddonLines = settle({ accepted: first.candidates, lines, delivery, refusals: NO_REFUSALS }).lines;
  const rest = assessOffers(
    entries.filter((entry) => !combinesAlways(entry)),
    withAddonLines,
    context,
  );
  const eligible = new Set([...first.eligible, ...rest.eligible]);
  return {
    candidates: [...first.candidates, ...rest.candidates],
    eligible: entries.filter((entry) => eligible.has(entry)),
    refusals: mergeRefusals(first.refusals, rest.refusals),
  };
}

/**
 * The cart's add-ons the quote dropped, in request order (D2506): those refused before pricing with their reason,
 * and `not_eligible` for every other one without an add-on line once the offers applied (eligibility, schedule or
 * condition failed, or the per-order cap left it no piece). A dropped add-on never makes the quote unavailable.
 */
export function rejectedAddonsOf(
  cart: PricingCart,
  requests: AddonRequests,
  lines: readonly RunningLine[],
): RejectedAddon[] {
  const priced = new Set(lines.filter((line) => line.addonOf !== undefined).map((line) => line.key));
  return cart.addons.flatMap(({ offerId, variantId }) => {
    const key = addonLineKey(variantId, offerId);
    const reason = requests.refused.get(key) ?? (priced.has(key) ? null : 'not_eligible');
    return reason === null ? [] : [{ offerId, variantId, reason }];
  });
}
