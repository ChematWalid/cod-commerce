import type { PricingCart } from '../../domain/cart';
import { OfferKindRegistry } from '../../domain/engine/kind-registry';
import { priceCart } from '../../domain/engine/pipeline';
import type { PricedQuote } from '../../domain/engine/priced-quote';
import { BUILT_IN_OFFER_KINDS } from '../../domain/kinds';
import type { Offer } from '../../domain/offer';
import type { PricingSnapshot, ShippingQuoteResult } from '../../domain/snapshot';
import { aCart, anOffer, aSnapshot } from './builders';

/** The registry of the built-in kinds, as the plugin wires it. */
export const REGISTRY = new OfferKindRegistry(BUILT_IN_OFFER_KINDS);

/** A resolved home delivery at 800 DZD without overweight (the brief's worked examples). */
export const HOME_800: ShippingQuoteResult = { resolved: true, baseFee: 800, overweightFee: 0, speed: null };

/** Tiers of the worked examples: 2 pieces 10 % off, 3 pieces 15 % off with free delivery. */
export const TIERS_2_AND_3 = {
  priceMode: 'percent',
  tiers: [
    { quantity: 2, price: 10 },
    { quantity: 3, price: 15, freeDelivery: true },
  ],
};

const PRODUCT_1 = [{ role: 'buy' as const, refType: 'product' as const, refId: '1' }];

/** A quantity offer 7001 on product 1 with {@link TIERS_2_AND_3}. */
export const aQuantityOffer = (overrides: Partial<Offer> = {}): Offer =>
  anOffer({ id: '7001', kind: 'quantity', config: TIERS_2_AND_3, targets: PRODUCT_1, ...overrides });

/** A product discount 7002 of 10 % on product 1. */
export const aProductDiscount = (overrides: Partial<Offer> = {}): Offer =>
  anOffer({
    id: '7002',
    kind: 'product_discount',
    config: { valueType: 'percent', value: 10, appliesTo: 'targets' },
    targets: PRODUCT_1,
    ...overrides,
  });

/** An order discount 7003 of 10 % without minimum. */
export const anOrderDiscount = (overrides: Partial<Offer> = {}): Offer =>
  anOffer({ id: '7003', kind: 'order_discount', config: { valueType: 'percent', value: 10 }, ...overrides });

/** A free-delivery offer 7004 without threshold. */
export const aFreeDelivery = (overrides: Partial<Offer> = {}): Offer =>
  anOffer({ id: '7004', kind: 'free_delivery', config: {}, ...overrides });

/** The engine's quote of a cart built from `cart` over a snapshot built from `snapshot`. */
export function quoteOf(snapshot: Partial<PricingSnapshot>, cart: Partial<PricingCart> = {}): PricedQuote {
  return priceCart({ registry: REGISTRY, snapshot: aSnapshot(snapshot), cart: aCart(cart) });
}
