import {
  type AddonPlacement,
  type Quote,
  type QuoteRequest,
  type QuoteRequestInput,
  quoteRequestSchema,
} from '@cod/shared';
import type { PricingCart } from '../domain/cart';
import { MS_PER_SECOND } from '../domain/constants';
import type { OfferKindRegistry } from '../domain/engine/kind-registry';
import { mergeLines } from '../domain/engine/merge-lines';
import { type OrderRelease, releaseOrderUsage } from '../domain/engine/order-usage';
import { priceCart } from '../domain/engine/pipeline';
import type { PricedQuote } from '../domain/engine/priced-quote';
import { InvalidQuoteRequestError, NoActiveStoreError } from '../domain/errors';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { PricingSnapshotSource } from '../domain/ports/pricing-snapshot-source.port';
import type { StoreScope } from '../domain/store-scope';
import type { QuoteVerification } from '../domain/token/quote-token';
import type { OrderFields, RepriceInput, RepriceResult } from './order-change';
import { parseOrderUsage, parseStoredTotal } from './order-usage.schema';
import type { QuoteSigner, TokenCart } from './quote-signer';
import { assertOnChannelOf } from './store-channel';

/** What the pricing use case is built from. */
export interface PricingServiceDeps {
  readonly stores: ActiveStorePort;
  /** The snapshot each cart is priced from (D2424): the store loader, or a cache in front of it. */
  readonly snapshots: PricingSnapshotSource;
  readonly signer: QuoteSigner;
  readonly kinds: OfferKindRegistry;
}

/**
 * Options of the trusted scoped quote, never fields of the public quote request (D2506): the placement whose add-ons
 * the quote may price. Checkout and the public quote use `order_form`; the post-order add-on use case `thank_you`.
 */
export interface ScopedQuoteOptions {
  readonly addonPlacement: AddonPlacement;
}

/** Checkout's options: the add-ons of the order form. */
const CHECKOUT: ScopedQuoteOptions = { addonPlacement: 'order_form' };

/** How a cart is evaluated: the quote's add-on placement and, when re-pricing an order, its own uses (D2427). */
interface Evaluation {
  readonly options: ScopedQuoteOptions;
  readonly release: OrderRelease | null;
}

/** The engine's pricing of a cart and the variants the gate refused in it. */
interface EvaluatedCart {
  readonly priced: PricedQuote;
  readonly unavailableVariantIds: readonly string[];
  /** The buyer's orders before the cart's order, as priced; null without a buyer. */
  readonly buyerOrdersBefore: number | null;
}

/** The engine's pricing of a cart and the quote the buyer gets. */
interface PricedCart {
  readonly priced: PricedQuote;
  readonly quote: Quote;
}

/** The request parsed: phone in E.164, unknown keys such as a body `storeId` stripped (D2408, D2418). */
function parseRequest(raw: QuoteRequestInput): QuoteRequest {
  const parsed = quoteRequestSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidQuoteRequestError();
  return parsed.data;
}

const tokenCartOf = (request: QuoteRequest): TokenCart => ({
  channel: request.channel,
  lines: request.lines,
  destination: request.destination ?? null,
  codes: request.codes ?? [],
  phone: request.phone ?? null,
  addons: request.addons,
});

/** The quote without the engine's token parts (`tokenLines`, `tokenDiscounts`, `tokenUses`, `phoneUsed`). */
function publicQuoteOf(priced: PricedQuote): Omit<Quote, 'quoteToken' | 'expiresAt'> {
  const { currency, lines, discounts, subtotal, discountTotal, delivery, total, savings, nudge } = priced;
  const { applied, skipped, rejectedCodes, rejectedAddons, suggestions, available } = priced;
  const { orderPricingMode, unavailableVariantIds } = priced;
  return {
    ...{ currency, lines, discounts, subtotal, discountTotal, delivery, total, savings, nudge },
    ...{ applied, skipped, rejectedCodes, rejectedAddons, suggestions, available, orderPricingMode },
    unavailableVariantIds,
  };
}

/** The quote without a token; `available: false` with the refused variants when the gate refused any. */
function unsignedQuoteOf({ priced, unavailableVariantIds }: EvaluatedCart): Quote {
  const unsigned = { ...publicQuoteOf(priced), quoteToken: null, expiresAt: null };
  if (unavailableVariantIds.length === 0) return unsigned;
  return { ...unsigned, available: false, unavailableVariantIds: [...unavailableVariantIds] };
}

function orderFieldsOf({ priced, buyerOrdersBefore }: EvaluatedCart): OrderFields {
  return {
    lines: priced.tokenLines.map(({ variantId, unitPrice, originalPrice, offerIds }) => ({
      variantId,
      quotedUnitPrice: unitPrice,
      originalPrice,
      offerIds,
    })),
    quoteDiscounts: JSON.stringify(priced.tokenDiscounts),
    quotedShipping: priced.delivery.price,
    appliedOffers: [...priced.tokenUses],
    buyerOrdersBefore,
  };
}

/**
 * Prices carts of a store into signed quotes, verifies quote tokens and prices order changes (ADR 0004, D2408). The
 * `quote`, `verifyQuote` and `repriceOrder` methods take the store from the tenant the guard resolved; the `…ForScope`
 * core is for trusted callers without a guarded request (jobs, tests, evidence) and still refuses a context that is
 * not on the store's own channel. No HTTP here: P3.S3 and P2.S5 wrap it.
 *
 * The request's `channel` (D2420) is asserted by the caller, not derived from `ctx`: offer eligibility by channel is
 * only as trustworthy as the wrapper that sets it. Each API surface must overwrite the body's `channel` with its own
 * (a storefront route always sends `storefront`), or a buyer could claim `dashboard` and unlock staff-only offers.
 */
export class PricingService {
  constructor(private readonly deps: PricingServiceDeps) {}

  /** The quote of `request` in the request's active store, order-form add-ons only. @throws {@link NoActiveStoreError}. */
  async quote(ctx: OperationContext, request: QuoteRequestInput): Promise<Quote> {
    return (await this.price(ctx, await this.activeStore(ctx), request, CHECKOUT)).quote;
  }

  /**
   * The quote of `request` in `scope` (D2425: without a token when a line is unavailable), pricing the add-ons of
   * `options.addonPlacement` (D2506; the order form unless a trusted caller asks for the thank-you page).
   *
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s channel.
   * @throws {@link InvalidQuoteRequestError} when the request breaks its schema.
   * @throws {@link PricingTotalTooLargeError} when the total leaves the money range.
   */
  async quoteForScope(
    ctx: OperationContext,
    scope: StoreScope,
    request: QuoteRequestInput,
    options: ScopedQuoteOptions = CHECKOUT,
  ): Promise<Quote> {
    await this.assertChannel(ctx, scope);
    return (await this.price(ctx, scope, request, options)).quote;
  }

  /** The verdict on `token` for `cart` in the request's active store. @throws {@link NoActiveStoreError}. */
  async verifyQuote(ctx: OperationContext, token: string, cart: QuoteRequestInput): Promise<QuoteVerification> {
    return this.deps.signer.verify(await this.activeStore(ctx), token, tokenCartOf(parseRequest(cart)));
  }

  /**
   * The verdict on `token` for `cart` in `scope`: the cart hash is recomputed from the submitted cart (merged,
   * normalised, with the keyed phone only when the token's `p` is 1).
   *
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s channel.
   * @throws {@link InvalidQuoteRequestError} when the cart breaks the request schema.
   */
  async verifyQuoteForScope(
    ctx: OperationContext,
    scope: StoreScope,
    token: string,
    cart: QuoteRequestInput,
  ): Promise<QuoteVerification> {
    await this.assertChannel(ctx, scope);
    return this.deps.signer.verify(scope, token, tokenCartOf(parseRequest(cart)));
  }

  /**
   * The order change priced in the request's active store; writes nothing. `available: false` (no delta, no order
   * fields) when either cart has a refused variant. @throws {@link NoActiveStoreError}.
   */
  async repriceOrder(ctx: OperationContext, input: RepriceInput): Promise<RepriceResult> {
    return this.reprice(ctx, await this.activeStore(ctx), input);
  }

  /** The order change priced in `scope`; writes nothing. @throws {@link NoActiveStoreError} off its channel. */
  async repriceOrderForScope(ctx: OperationContext, scope: StoreScope, input: RepriceInput): Promise<RepriceResult> {
    await this.assertChannel(ctx, scope);
    return this.reprice(ctx, scope, input);
  }

  private async reprice(ctx: OperationContext, scope: StoreScope, input: RepriceInput): Promise<RepriceResult> {
    const usage = parseOrderUsage(input.orderUsage);
    const storedTotal = parseStoredTotal(input.storedTotal);
    const current = parseRequest(input.current);
    const next = parseRequest(input.next);
    const ownBuyer = (next.phone ?? null) === (current.phone ?? null);
    const before = await this.evaluate(ctx, scope, current, {
      options: CHECKOUT,
      release: { ...usage, ownBuyer: true },
    });
    const after = await this.evaluate(ctx, scope, next, { options: CHECKOUT, release: { ...usage, ownBuyer } });
    const [beforeQuote, afterQuote] = [unsignedQuoteOf(before), unsignedQuoteOf(after)];
    const refused = [...before.unavailableVariantIds, ...after.unavailableVariantIds];
    if (refused.length > 0) {
      return { available: false, before: beforeQuote, after: afterQuote, unavailableVariantIds: [...new Set(refused)] };
    }
    return {
      available: true,
      before: beforeQuote,
      after: afterQuote,
      delta: afterQuote.total - storedTotal,
      drift: beforeQuote.total - storedTotal,
      orderFields: orderFieldsOf(after),
    };
  }

  /** Parse → price → sign when every line is available (D2412, D2425). */
  private async price(
    ctx: OperationContext,
    scope: StoreScope,
    raw: QuoteRequestInput,
    options: ScopedQuoteOptions,
  ): Promise<PricedCart> {
    const request = parseRequest(raw);
    const evaluated = await this.evaluate(ctx, scope, request, { options, release: null });
    const { priced } = evaluated;
    if (evaluated.unavailableVariantIds.length > 0) return { priced, quote: unsignedQuoteOf(evaluated) };
    const signed = this.deps.signer.sign(scope, priced, tokenCartOf(request));
    const expiresAt = new Date(signed.expiresAt * MS_PER_SECOND).toISOString();
    return { priced, quote: { ...publicQuoteOf(priced), quoteToken: signed.token, expiresAt } };
  }

  /** Merge lines → load the snapshot (with an order's own uses given back when re-pricing it, D2427) → price. */
  private async evaluate(
    ctx: OperationContext,
    scope: StoreScope,
    request: QuoteRequest,
    { options, release }: Evaluation,
  ): Promise<EvaluatedCart> {
    const destination = request.destination ?? null;
    const phone = request.phone ?? null;
    const buyer = phone === null ? null : { phone };
    const codes = request.codes ?? [];
    const { addons } = request;
    const lines = mergeLines(request.lines);
    const loaded = await this.deps.snapshots.load(ctx, scope, { lines, destination, buyer, codes, addons });
    const cart: PricingCart = {
      ...{ channel: request.channel, lines: loaded.lines, destination, buyer, codes },
      ...{ addons: loaded.addons, addonPlacement: options.addonPlacement },
    };
    const snapshot = release === null ? loaded.snapshot : releaseOrderUsage(loaded.snapshot, release);
    const priced = priceCart({ registry: this.deps.kinds, snapshot, cart });
    return { priced, unavailableVariantIds: loaded.unavailableVariantIds, buyerOrdersBefore: snapshot.buyerOrderCount };
  }

  private async activeStore(ctx: OperationContext): Promise<StoreScope> {
    const scope = await this.deps.stores.activeStoreOf(ctx);
    if (scope === undefined) throw new NoActiveStoreError();
    return scope;
  }

  private assertChannel(ctx: OperationContext, scope: StoreScope): Promise<void> {
    return assertOnChannelOf(this.deps.stores, ctx, scope);
  }
}
