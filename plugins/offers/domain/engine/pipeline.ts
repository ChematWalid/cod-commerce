import {
  type AppliedOffer,
  ORDER_PRICING_MODES,
  PLATFORM_CURRENCY_CODE,
  type OrderDiscount,
  type RejectedCode,
} from '@cod/shared';
import type { PricingCart, RunningLine } from '../cart';
import type { PricingSnapshot } from '../snapshot';
import { addonRequestsOf, assessWithAddons, rejectedAddonsOf, withAddons, type AddonRequests } from './addon-lines';
import { entriesOf } from './candidates';
import { resolveCodes } from './codes';
import { combine } from './combine';
import { deliveryBlock, deliveryContextOf } from './delivery';
import { nudgeOf, suggestionsOf } from './hints';
import type { OfferKindRegistry } from './kind-registry';
import type { DeliveryContext } from './outcome';
import { quoteLinesOf, tokenAddonsOf, tokenLinesOf } from './line-stage';
import { mergeLines } from './merge-lines';
import type { PricedQuote, TokenDiscount, TokenUse } from './priced-quote';
import { runningLinesOf, type OfferEntry } from './pricing-state';
import { mergeRefusals, refusalOf } from './refusals';
import { settle, type SettledState } from './settle';
import { totalsOf } from './totals';

/** What the engine prices: the kinds, everything loaded for the quote and the cart. */
export interface PriceCartInput {
  readonly registry: OfferKindRegistry;
  readonly snapshot: PricingSnapshot;
  readonly cart: PricingCart;
}

/** The only quote pricing mode (D2426). */
const [QUOTE_PRICING_MODE] = ORDER_PRICING_MODES;

/** What pricing the offers gives, before the quote is assembled. */
interface PricedOffers {
  readonly lines: readonly RunningLine[];
  readonly delivery: DeliveryContext;
  readonly eligible: readonly OfferEntry[];
  readonly codeRejections: readonly RejectedCode[];
  readonly addons: AddonRequests;
  readonly settled: SettledState;
}

/**
 * Merge lines → resolve codes → sort the add-ons (D2506) → assess offers on the lines before offers, add-ons first
 * (D2507) → combine (D2411) → apply by stage.
 */
function priceOffers({ registry, snapshot, cart }: PriceCartInput): PricedOffers {
  const lines = runningLinesOf(mergeLines(cart.lines));
  const delivery = deliveryContextOf(snapshot.shipping, cart.destination);
  const codes = resolveCodes(cart.codes, snapshot);
  const offered = entriesOf(registry, snapshot.offers, codes.activated);
  const addons = addonRequestsOf(offered, cart);
  const entries = withAddons(offered, addons);
  const assessment = assessWithAddons(entries, lines, { cart: { ...cart, lines }, snapshot, delivery });
  const { accepted, rejected } = combine(assessment.candidates);
  const losers = rejected.map((candidate) => refusalOf(candidate, 'not_combinable'));
  const refusals = losers.reduce(mergeRefusals, assessment.refusals);
  const settled = settle({ accepted, lines, delivery, refusals });
  return { lines, delivery, eligible: assessment.eligible, codeRejections: codes.rejected, addons, settled };
}

/** The order discounts as the token signs them (ADR 0004 `d`). */
const tokenDiscountsOf = (discounts: readonly OrderDiscount[]): TokenDiscount[] =>
  discounts.map(({ amount, offerId, code }) => ({ amount, offerId, ...(code === undefined ? {} : { code }) }));

/** Every applied offer with its code, as the token signs them (ADR 0004 `o`, D2445). */
const tokenUsesOf = (applied: readonly AppliedOffer[]): TokenUse[] =>
  applied.map(({ offerId, code }) => ({ offerId, ...(code === undefined ? {} : { code }) }));

/**
 * Prices a cart (ADR 0004, D2412): offers by stage, then delivery → totals → nudge and suggestions. Pure: everything
 * it reads is in the input. Every line is available here; the service marks unavailable variants (D2425).
 *
 * @throws PricingTotalTooLargeError when the total leaves the money range (D2415).
 */
export function priceCart(input: PriceCartInput): PricedQuote {
  const { lines, delivery, eligible, codeRejections, addons, settled } = priceOffers(input);
  const quoteLines = quoteLinesOf(settled.lines, settled.lineDiscounts);
  const deliveryOut = deliveryBlock(input.snapshot.shipping, settled.waived);
  const discounts = [...settled.orderDiscounts];
  return {
    currency: PLATFORM_CURRENCY_CODE,
    lines: quoteLines,
    discounts,
    ...totalsOf({ lines: quoteLines, discounts, delivery: deliveryOut }),
    delivery: deliveryOut,
    nudge: nudgeOf(eligible, lines, delivery),
    applied: [...settled.applied],
    skipped: [...settled.refusals.skipped],
    rejectedCodes: [...codeRejections, ...settled.refusals.rejectedCodes],
    rejectedAddons: rejectedAddonsOf(input.cart, addons, settled.lines),
    suggestions: suggestionsOf({ entries: eligible, lines: settled.lines, delivery, waived: settled.waived }),
    available: true,
    orderPricingMode: QUOTE_PRICING_MODE,
    unavailableVariantIds: [],
    tokenLines: tokenLinesOf(quoteLines),
    tokenAddons: tokenAddonsOf(quoteLines),
    tokenDiscounts: tokenDiscountsOf(discounts),
    tokenUses: tokenUsesOf(settled.applied),
    phoneUsed: settled.phoneUsed,
  };
}
