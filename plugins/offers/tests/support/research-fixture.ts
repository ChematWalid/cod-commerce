import type { PricingDestination } from '../../domain/cart';
import type { PricedQuote } from '../../domain/engine/priced-quote';
import type { Offer } from '../../domain/offer';
import type { ShippingQuoteResult } from '../../domain/snapshot';
import { aLine, anOffer, UNIT_PRICE } from './builders';
import { quoteOf } from './pipeline';

/**
 * The reference product's worked example (docs/research): one product at 4,900 DZD, home delivery 800, stop desk
 * 500, no overweight, a 2-piece tier at 10 % off and a 3-piece tier with free delivery. The research elides the
 * 3-piece percentage; 15 % is this fixture's assumption (listed as a product question in the handoff).
 */
export const RESEARCH_UNIT_PRICE = UNIT_PRICE;
export const RESEARCH_HOME_FEE = 800;
export const RESEARCH_DESK_FEE = 500;

/** Resolved shipping quotes of the two delivery methods, without overweight. */
export const RESEARCH_HOME: ShippingQuoteResult = {
  resolved: true,
  baseFee: RESEARCH_HOME_FEE,
  overweightFee: 0,
  speed: null,
};
export const RESEARCH_DESK: ShippingQuoteResult = {
  resolved: true,
  baseFee: RESEARCH_DESK_FEE,
  overweightFee: 0,
  speed: null,
};

/** Destinations in Algiers (16), at the buyer's home or a stop desk. */
export const HOME_DESTINATION: PricingDestination = { provinceCode: '16', stopdesk: false };
export const DESK_DESTINATION: PricingDestination = { provinceCode: '16', stopdesk: true };

const RESEARCH_PRODUCT = [{ role: 'buy' as const, refType: 'product' as const, refId: '1' }];

/** The research's quantity offer, percent mode: 2 pieces 10 % off, 3 pieces 15 % off (assumed) + free delivery. */
export const researchQuantityOffer = (overrides: Partial<Offer> = {}): Offer =>
  anOffer({
    id: '7101',
    kind: 'quantity',
    config: {
      priceMode: 'percent',
      tiers: [
        { quantity: 2, price: 10 },
        { quantity: 3, price: 15, freeDelivery: true },
      ],
    },
    targets: RESEARCH_PRODUCT,
    ...overrides,
  });

/** The same offer in total mode: 3 pieces for 12,900 DZD with free delivery. */
export const researchTotalModeOffer = (): Offer =>
  researchQuantityOffer({
    id: '7102',
    config: { priceMode: 'total', tiers: [{ quantity: 3, price: 12_900, freeDelivery: true }] },
  });

/** How the research cart is delivered. */
export type ResearchDelivery = 'home' | 'desk';

/** The engine's quote of `pieces` of the research product, delivered home or to a desk, under `offers`. */
export function researchQuote(
  pieces: number,
  delivery: ResearchDelivery = 'home',
  offers: readonly Offer[] = [researchQuantityOffer()],
): PricedQuote {
  const home = delivery === 'home';
  return quoteOf(
    { offers, shipping: home ? RESEARCH_HOME : RESEARCH_DESK },
    { lines: [aLine({ quantity: pieces })], destination: home ? HOME_DESTINATION : DESK_DESTINATION },
  );
}
