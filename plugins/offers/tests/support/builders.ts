import type { OfferEligibility } from '@cod/shared';
import type { PricedLine, PricingCart } from '../../domain/cart';
import type { Offer } from '../../domain/offer';
import { type PricingSnapshot, UNRESOLVED_SHIPPING } from '../../domain/snapshot';

/** A fixed instant the builders date offers and snapshots from. */
export const T0 = new Date(Date.UTC(2026, 10, 14, 9, 0, 0));

const MINUTE_MS = 60_000;

/** {@link T0} plus `minutes` (negative for before). */
export const at = (minutes: number): Date => new Date(T0.getTime() + minutes * MINUTE_MS);

/** The 4,900 DZD unit price of the brief's worked examples. */
export const UNIT_PRICE = 4_900;

const EVERYONE_EVERYWHERE: OfferEligibility = { audience: 'everyone', channels: [], wilayas: [], deliveryMethods: [] };

/** An active automatic offer published an hour before {@link T0}, with no limit, eligibility or target. */
export function anOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: '7001',
    kind: 'quantity',
    method: 'automatic',
    title: 'Buy more, save more',
    label: {},
    config: {},
    combinesWith: { order: false, product: false, delivery: false },
    eligibility: EVERYONE_EVERYWHERE,
    totalUsageLimit: null,
    perBuyerLimit: null,
    status: 'active',
    startsAt: null,
    endsAt: null,
    publishedAt: at(-60),
    usageCount: 0,
    targets: [],
    ...overrides,
  };
}

/** A line of one piece of variant `variantId` of product `productId` at {@link UNIT_PRICE}, in no collection. */
export function aLine(overrides: Partial<PricedLine> = {}): PricedLine {
  const variantId = overrides.variantId ?? '11';
  return {
    key: variantId,
    productId: '1',
    variantId,
    quantity: 1,
    originalPrice: UNIT_PRICE,
    collectionIds: [],
    ...overrides,
  };
}

/** A storefront cart of one line, home delivery to Algiers (16), without buyer, code or add-on, at checkout. */
export function aCart(overrides: Partial<PricingCart> = {}): PricingCart {
  return {
    channel: 'storefront',
    lines: [aLine()],
    destination: { provinceCode: '16', stopdesk: false },
    buyer: null,
    codes: [],
    addons: [],
    addonPlacement: 'order_form',
    ...overrides,
  };
}

/** A shipping quote the fee table did not resolve (the default before P3.S1, D2423). */
export { UNRESOLVED_SHIPPING };

/** A snapshot at {@link T0} with no offer, code, usage or buyer history. */
export function aSnapshot(overrides: Partial<PricingSnapshot> = {}): PricingSnapshot {
  return {
    offers: [],
    codes: new Map(),
    perBuyerUsage: new Map(),
    buyerOrderCount: null,
    shipping: UNRESOLVED_SHIPPING,
    now: T0,
    ...overrides,
  };
}

/** A buyer with an E.164 phone (synthetic). */
export const A_BUYER = { phone: '+213555000001' } as const;
