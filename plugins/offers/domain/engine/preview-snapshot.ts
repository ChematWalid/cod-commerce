import type { AddonPlacement, OfferCommand, OfferTargetRole, TargetRefType } from '@cod/shared';
import type { CartAddon, PricedLine, PricingCart } from '../cart';
import {
  CODES_METHOD,
  PREVIEW_ADDON_PIECES,
  PREVIEW_CODE,
  PREVIEW_DEFAULT_CHANNEL,
  PREVIEW_GET_PIECES,
  PREVIEW_ITEM_IDS,
  PREVIEW_OFFER_ID,
} from '../constants';
import type { Offer } from '../offer';
import type { CodeEntry, PricingSnapshot, ShippingQuoteResult } from '../snapshot';
import type { PreviewCart } from './kind-registry';

/** The unsaved offer a preview prices, as the admin input schema outputs it, and where its kind offers add-ons. */
export interface PreviewDraft {
  readonly command: OfferCommand;
  readonly addonPlacement: AddonPlacement;
}

/** The sample unit price of every line and the sample delivery fee of a preview, in DZD, and its instant. */
export interface PreviewSample {
  readonly price: number;
  readonly deliveryFee: number;
  readonly now: Date;
}

/** What the engine prices for one preview cart: a snapshot holding only the draft, and the synthetic cart. */
export interface PreparedPreview {
  readonly snapshot: PricingSnapshot;
  readonly cart: PricingCart;
}

/** The product, variant and collections of a synthetic line. */
interface PreviewItem {
  readonly productId: string;
  readonly variantId: string;
  readonly collectionIds: readonly string[];
}

/** How a target of each type names a synthetic line (§3a.7): its variant, its product or one of its collections. */
const ITEM_NAMERS: Readonly<Record<TargetRefType, (item: PreviewItem, refId: string) => PreviewItem>> = {
  variant: (item, refId) => ({ ...item, variantId: refId }),
  product: (item, refId) => ({ ...item, productId: refId }),
  collection: (item, refId) => ({ ...item, collectionIds: [refId] }),
};

/** The item the draft's first target of `role` names, synthetic ids elsewhere (D2516). */
function itemOf(command: OfferCommand, role: OfferTargetRole): PreviewItem {
  const synthetic: PreviewItem = { ...PREVIEW_ITEM_IDS[role], collectionIds: [] };
  const target = command.targets.find((candidate) => candidate.role === role);
  return target === undefined ? synthetic : ITEM_NAMERS[target.refType](synthetic, target.refId);
}

/** A line of `quantity` pieces of `item` at the sample price. */
const lineOf = (item: PreviewItem, quantity: number, price: number): PricedLine => ({
  key: item.variantId,
  ...item,
  quantity,
  originalPrice: price,
});

/** The buy line, and the get line when the cart holds one; a line of no piece is left out. */
function linesOf(command: OfferCommand, cart: PreviewCart, price: number): PricedLine[] {
  const getPieces = cart.withGet ? (cart.getPieces ?? PREVIEW_GET_PIECES) : 0;
  const lines = [lineOf(itemOf(command, 'buy'), cart.pieces - getPieces, price)];
  if (cart.withGet) lines.push(lineOf(itemOf(command, 'get'), getPieces, price));
  return lines.filter((line) => line.quantity > 0);
}

/** The add-on of the draft's first add-on target, accepted at the sample price. */
function addonOf(command: OfferCommand, price: number): CartAddon {
  const { variantId, productId, collectionIds } = itemOf(command, 'addon');
  const priced = { productId, originalPrice: price, collectionIds };
  return { offerId: PREVIEW_OFFER_ID, variantId, quantity: PREVIEW_ADDON_PIECES, priced };
}

/**
 * The draft as one active offer (D2516): no schedule, usage limit, audience, wilaya or delivery method, which the
 * summary shows instead; its channels stay, and the cart is priced on the first of them.
 */
function draftOfferOf(command: OfferCommand, now: Date): Offer {
  const { kind, method, title, label, config, combinesWith, eligibility, targets } = command;
  return {
    ...{ id: PREVIEW_OFFER_ID, kind, method, title, label, config, combinesWith, targets },
    eligibility: { audience: 'everyone', channels: eligibility.channels, wilayas: [], deliveryMethods: [] },
    ...{ totalUsageLimit: null, perBuyerLimit: null, usageCount: 0 },
    ...{ status: 'active', startsAt: null, endsAt: null, publishedAt: now },
  };
}

/** The synthetic code activating a draft activated by codes, or none. */
const codesOf = (command: OfferCommand): ReadonlyMap<string, CodeEntry> =>
  command.method === CODES_METHOD
    ? new Map([[PREVIEW_CODE, { offerId: PREVIEW_OFFER_ID, usageLimit: null, usageCount: 0 }]])
    : new Map();

/**
 * The snapshot and cart a preview prices for one `cart` of a kind (D2516), pure: the draft as the only offer,
 * delivery resolved at the sample fee, synthetic lines named by the draft's first `buy` (and `get`) target at the
 * sample price, the add-on of its first `addon` target accepted when the cart holds one, its synthetic code typed
 * when it is activated by codes, on its first allowed channel, without destination or buyer.
 */
export function previewSnapshot(draft: PreviewDraft, cart: PreviewCart, sample: PreviewSample): PreparedPreview {
  const { command } = draft;
  const shipping: ShippingQuoteResult = { resolved: true, baseFee: sample.deliveryFee, overweightFee: 0, speed: null };
  const codes = codesOf(command);
  return {
    snapshot: {
      offers: [draftOfferOf(command, sample.now)],
      codes,
      perBuyerUsage: new Map(),
      buyerOrderCount: null,
      shipping,
      now: sample.now,
    },
    cart: {
      channel: command.eligibility.channels[0] ?? PREVIEW_DEFAULT_CHANNEL,
      lines: linesOf(command, cart, sample.price),
      destination: null,
      buyer: null,
      codes: [...codes.keys()],
      addons: cart.withAddon ? [addonOf(command, sample.price)] : [],
      addonPlacement: draft.addonPlacement,
    },
  };
}
