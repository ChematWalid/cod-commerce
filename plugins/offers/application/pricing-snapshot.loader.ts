import type { QuoteAddonInput } from '@cod/shared';
import type { BuyerRef, CartAddon, PricedLine } from '../domain/cart';
import { type CoreId, parseCoreId } from '../domain/core-id';
import type { OfferKindRegistry } from '../domain/engine/kind-registry';
import type { MergeableLine } from '../domain/engine/merge-lines';
import type { Offer } from '../domain/offer';
import type { BuyerHistory } from '../domain/ports/buyer-history.port';
import type { Clock } from '../domain/ports/clock.port';
import type { CollectionMembership } from '../domain/ports/collection-membership.port';
import type { OfferCodeRepositoryPort, OfferRepositoryPort } from '../domain/ports/offer-repository.port';
import type { OfferUsageCounts } from '../domain/ports/offer-usage.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { PricingLogger } from '../domain/ports/pricing-logger.port';
import type { LoadedCart, PricingSnapshotSource, SnapshotRequest } from '../domain/ports/pricing-snapshot-source.port';
import type { ShippingQuoteSource } from '../domain/ports/shipping-quote.port';
import type { ResolvedUnitPrice, UnitPriceSource } from '../domain/ports/unit-price-resolver.port';
import {
  type CodeEntry,
  type PricingSnapshot,
  type ShippingQuoteResult,
  UNRESOLVED_SHIPPING,
} from '../domain/snapshot';
import type { StoreScope } from '../domain/store-scope';
import type { SourceHolder } from './single-source.registry';

/** Everything a quote's snapshot is read through (D2423, D2424). */
export interface PricingSnapshotPorts {
  readonly offers: OfferRepositoryPort;
  readonly codes: OfferCodeRepositoryPort;
  readonly unitPrices: UnitPriceSource;
  readonly collections: SourceHolder<CollectionMembership>;
  readonly shipping: SourceHolder<ShippingQuoteSource>;
  readonly buyers: SourceHolder<BuyerHistory>;
  readonly usage: SourceHolder<OfferUsageCounts>;
  readonly kinds: OfferKindRegistry;
  readonly logger: PricingLogger;
  readonly clock: Clock;
}

/** A buyer without a phone has no history: audience and per-buyer offers are skipped (D2418, D2435). */
const NO_BUYER_USAGE: ReadonlyMap<string, number> = new Map();

/** The distinct variant ids of the lines and add-ons, as core ids: the gate prices both in one call (D2506). */
const coreIdsOf = (lines: readonly MergeableLine[], addons: readonly QuoteAddonInput[]): CoreId[] => {
  const variantIds = new Set([...lines, ...addons].map((item) => item.variantId));
  return [...variantIds].flatMap((variantId) => parseCoreId(variantId) ?? []);
};

/** Collection ids of each product, by product id. */
type Memberships = ReadonlyMap<string, readonly string[]>;

/** The accepted lines in cart order, each in its product's collections; the product always comes from the gate. */
function pricedLinesOf(
  lines: readonly MergeableLine[],
  prices: ReadonlyMap<string, ResolvedUnitPrice>,
  memberships: Memberships,
): PricedLine[] {
  return lines.flatMap((line) => {
    const price = prices.get(line.variantId);
    if (price === undefined) return [];
    const { variantId, productId, unitPrice } = price;
    const collectionIds = [...(memberships.get(productId) ?? [])];
    return [{ key: variantId, productId, variantId, quantity: line.quantity, originalPrice: unitPrice, collectionIds }];
  });
}

/** The add-ons in request order with the gate's price of their variant, or `priced: null` when it refused it. */
function cartAddonsOf(
  addons: readonly QuoteAddonInput[],
  prices: ReadonlyMap<string, ResolvedUnitPrice>,
  memberships: Memberships,
): CartAddon[] {
  return addons.map(({ offerId, variantId, quantity }) => {
    const price = prices.get(variantId);
    if (price === undefined) return { offerId, variantId, quantity, priced: null };
    const collectionIds = [...(memberships.get(price.productId) ?? [])];
    return {
      offerId,
      variantId,
      quantity,
      priced: { productId: price.productId, originalPrice: price.unitPrice, collectionIds },
    };
  });
}

/**
 * Loads what one quote reads before the pure engine runs (D2424): the gated unit prices of the lines and add-ons,
 * collection memberships, the store's active offers of a known kind and a valid config, the submitted codes, the
 * shipping quote of the lines (add-ons left out, D2531) and the buyer's history. Nothing is cached here: it answers
 * the {@link PricingSnapshotSource} port, and P3.S3 wraps it with a caching adapter.
 */
export class PricingSnapshotLoader implements PricingSnapshotSource {
  /** Offers already reported for an unknown kind or an invalid config, so each is logged once per process. */
  private readonly reportedOffers = new Set<string>();

  constructor(private readonly ports: PricingSnapshotPorts) {}

  /**
   * The snapshot of `request` in `scope`, the lines the gate accepted (at their unit price, in cart order) and
   * `unavailableVariantIds`, the variants it refused: a refused variant is reported, never thrown (D2425). The shipping
   * source is not asked without a destination (unresolved delivery, fees 0, D2423); buyer history and per-buyer usage
   * are not read without a phone, and usage only for offers with a per-buyer limit (D2418).
   */
  async load(ctx: OperationContext, scope: StoreScope, request: SnapshotRequest): Promise<LoadedCart> {
    const prices = await this.ports.unitPrices.pricesOf(ctx, scope, coreIdsOf(request.lines, request.addons));
    const memberships = await this.membershipsOf(ctx, scope, prices);
    const lines = pricedLinesOf(request.lines, prices, memberships);
    const offers = await this.knownOffers(ctx, scope);
    const snapshot: PricingSnapshot = {
      offers,
      codes: await this.codesOf(ctx, scope, request.codes),
      shipping: await this.shippingOf(ctx, scope, request, prices),
      ...(await this.buyerOf(ctx, scope, request.buyer, offers)),
      now: this.ports.clock.now(),
    };
    const unavailableVariantIds = request.lines.filter((line) => !prices.has(line.variantId)).map((l) => l.variantId);
    const addons = cartAddonsOf(request.addons, prices, memberships);
    return { snapshot, lines, unavailableVariantIds, addons };
  }

  /** The collections of every product the gate priced, by product id; the source is not asked without one. */
  private async membershipsOf(
    ctx: OperationContext,
    scope: StoreScope,
    prices: ReadonlyMap<string, ResolvedUnitPrice>,
  ): Promise<Memberships> {
    const productIds = [...new Set([...prices.values()].map((price) => price.productId))];
    if (productIds.length === 0) return new Map();
    return this.ports.collections.current().collectionsOf(ctx, scope, productIds);
  }

  /**
   * The store's active offers the engine can price: an unknown kind (D2404) or a stored config its kind's schema no
   * longer accepts (D2450) is left out and reported, so one stale offer never fails every quote of the store.
   */
  private async knownOffers(ctx: OperationContext, scope: StoreScope): Promise<readonly Offer[]> {
    const active = await this.ports.offers.activeOf(ctx, scope);
    return active.filter((offer) => {
      const calculator = this.ports.kinds.get(offer.kind);
      if (calculator === undefined) {
        if (this.firstReportOf(offer.id)) this.ports.logger.unknownKind(offer.id, offer.kind);
        return false;
      }
      if (calculator.configSchema.safeParse(offer.config).success) return true;
      if (this.firstReportOf(offer.id)) this.ports.logger.invalidConfig(offer.id, offer.kind);
      return false;
    });
  }

  /** Whether the offer is not reported yet; it counts as reported from now on. */
  private firstReportOf(offerId: string): boolean {
    if (this.reportedOffers.has(offerId)) return false;
    this.reportedOffers.add(offerId);
    return true;
  }

  /** The store's codes among the submitted ones, by normalised text (D2406). */
  private async codesOf(
    ctx: OperationContext,
    scope: StoreScope,
    codes: readonly string[],
  ): Promise<ReadonlyMap<string, CodeEntry>> {
    if (codes.length === 0) return new Map();
    const stored = await this.ports.codes.findByCodes(ctx, scope, codes);
    return new Map(
      stored.map(({ code, offerId, usageLimit, usageCount }) => [code, { offerId, usageLimit, usageCount }]),
    );
  }

  /** The fee table's quote for the accepted lines, or an unresolved delivery before a destination is chosen. */
  private shippingOf(
    ctx: OperationContext,
    scope: StoreScope,
    { destination, lines }: SnapshotRequest,
    prices: ReadonlyMap<string, ResolvedUnitPrice>,
  ): Promise<ShippingQuoteResult> {
    if (destination === null) return Promise.resolve(UNRESOLVED_SHIPPING);
    const items = lines.flatMap((line) => {
      const price = prices.get(line.variantId);
      if (price === undefined) return [];
      const { productId, variantId, weightGrams } = price;
      return [{ productId, variantId, quantity: line.quantity, ...(weightGrams === undefined ? {} : { weightGrams }) }];
    });
    return this.ports.shipping.current().quote(ctx, scope, { ...destination, items });
  }

  /** The buyer's order count and uses of the per-buyer limited offers; nothing without a phone (D2418). */
  private async buyerOf(
    ctx: OperationContext,
    scope: StoreScope,
    buyer: BuyerRef | null,
    offers: readonly Offer[],
  ): Promise<Pick<PricingSnapshot, 'buyerOrderCount' | 'perBuyerUsage'>> {
    if (buyer === null) return { buyerOrderCount: null, perBuyerUsage: NO_BUYER_USAGE };
    const buyerOrderCount = await this.ports.buyers.current().orderCountOf(ctx, scope, buyer);
    const limited = offers.filter((offer) => offer.perBuyerLimit !== null).map((offer) => offer.id);
    const perBuyerUsage =
      limited.length === 0 ? NO_BUYER_USAGE : await this.ports.usage.current().perBuyer(ctx, scope, limited, buyer);
    return { buyerOrderCount, perBuyerUsage };
  }
}
