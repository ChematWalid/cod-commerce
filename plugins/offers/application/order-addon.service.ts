import { isSnowflake, type OfferAppliedPayload, type Quote, type QuoteRequest, type Snowflake } from '@cod/shared';
import { ADDON_EDITABLE_ORDER_STATUSES } from '../domain/constants';
import { AddonNotOfferedError, OrderNotEditableError, OrderNotFoundForAddonError } from '../domain/errors';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OfferEventsPort } from '../domain/ports/offer-events.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { AddonOrder, OrderAddonTarget, PricedAddonLine } from '../domain/ports/order-addon-target.port';
import type { StoreScope } from '../domain/store-scope';
import type { PricingService, ScopedQuoteOptions } from './pricing.service';
import type { SourceHolder } from './single-source.registry';
import { assertOnChannelOf } from './store-channel';

/** What the post-order add-on use case is built from. */
export interface OrderAddonPorts {
  /** Checks every call's `ctx` is on `scope`'s active store channel (D2408). */
  readonly stores: ActiveStorePort;
  /** The order source P3.S4 registers; refuses every call until then (D2508). */
  readonly orders: SourceHolder<OrderAddonTarget>;
  /** The trusted scoped quote, asked with the thank-you placement (D2506). */
  readonly pricing: Pick<PricingService, 'quoteForScope'>;
  readonly events: OfferEventsPort;
}

/** The add-on a buyer accepted on the thank-you page of an order. */
export interface OrderAddonInput {
  readonly orderId: string;
  readonly offerId: string;
  readonly variantId: string;
  readonly quantity: number;
}

/** One add-on entry of a quote request. */
type QuoteAddon = QuoteRequest['addons'][number];

/** The thank-you page's quote options: only its add-ons are priced, the order form's are refused (D2506). */
const THANK_YOU: ScopedQuoteOptions = { addonPlacement: 'thank_you' };

/** The pieces of the add-on of `offerId` on `variantId` the order already holds. */
function heldPiecesOf(cart: QuoteRequest, { offerId, variantId }: QuoteAddon): number {
  const held = cart.addons.find((addon) => addon.offerId === offerId && addon.variantId === variantId);
  return held?.quantity ?? 0;
}

/**
 * The order's cart with the accepted add-on: an entry of the same offer and variant the order already holds is
 * summed with it, so the engine caps the order's pieces together at the offer's per-order cap (D2532 b).
 */
function cartWithAddon(cart: QuoteRequest, accepted: QuoteAddon): QuoteRequest {
  const { offerId, variantId } = accepted;
  const others = cart.addons.filter((addon) => addon.offerId !== offerId || addon.variantId !== variantId);
  const quantity = heldPiecesOf(cart, accepted) + accepted.quantity;
  return { ...cart, addons: [...others, { ...accepted, quantity }] };
}

/**
 * The add-on line the quote priced for `input`, with its offer's kind, less the `heldPieces` already on the order.
 *
 * @throws {@link AddonNotOfferedError} when nothing is priced or the order already holds the capped pieces.
 */
function pricedAddonOf(quote: Quote, { offerId, variantId }: OrderAddonInput, heldPieces: number): PricedAddonLine {
  const line = quote.lines.find((candidate) => candidate.addonOf === offerId && candidate.variantId === variantId);
  const applied = quote.applied.find((offer) => offer.offerId === offerId);
  if (line === undefined || applied === undefined) throw new AddonNotOfferedError();
  const quantity = line.quantity - heldPieces;
  if (quantity <= 0) throw new AddonNotOfferedError();
  const { productId, originalPrice, unitPrice, parentVariantId = null } = line;
  return { offerId, kind: applied.kind, productId, variantId, quantity, originalPrice, unitPrice, parentVariantId };
}

/** The order and the offer of an applied add-on, as checked snowflake ids. */
interface AppliedIds {
  readonly orderId: Snowflake;
  readonly offerId: Snowflake;
}

/** The `offer.applied` payload of an appended add-on: ids and the buyer's saving on it, nothing else (D2509). */
function appliedPayloadOf(scope: StoreScope, ids: AppliedIds, line: PricedAddonLine): OfferAppliedPayload {
  return {
    ...ids,
    kind: line.kind,
    storeId: scope.storeId,
    amount: (line.originalPrice - line.unitPrice) * line.quantity,
    source: 'post_order_addon',
  };
}

/**
 * Appends an add-on the buyer accepted on the thank-you page to their order (D2508), priced by the engine against
 * the order's own cart. No HTTP endpoint in P2.S5: P3.S4 and P4.S1 call it. The line is appended and `offer.applied`
 * written to the outbox through the transaction `ctx` carries, so the caller runs it in the order's transaction and
 * both commit or neither does.
 */
export class OrderAddonService {
  constructor(private readonly ports: OrderAddonPorts) {}

  /**
   * Prices the add-on with the thank-you placement, appends it to the order and publishes `offer.applied`. A repeat
   * of an add-on the order holds appends only the pieces still under the offer's per-order cap.
   *
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s active store channel.
   * @throws {@link OrderAddonUnavailableError} while no order source is registered.
   * @throws {@link OrderNotFoundForAddonError} when the store has no such order.
   * @throws {@link OrderNotEditableError} when the order is past `pending` and `unconfirmed`.
   * @throws {@link AddonNotOfferedError} unless an active thank-you add-on offer of the store offers the variant, or
   *   when the order already holds the offer's per-order pieces.
   * @throws {@link InvalidQuoteRequestError} when the order's cart with the add-on breaks the quote schema.
   */
  async addAddonToOrder(ctx: OperationContext, scope: StoreScope, input: OrderAddonInput): Promise<PricedAddonLine> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const target = this.ports.orders.current();
    const order = await this.editableOrder(target, ctx, scope, input.orderId);
    const { offerId, variantId, quantity } = input;
    if (!isSnowflake(offerId)) throw new AddonNotOfferedError();
    const accepted = { offerId, variantId, quantity };
    const cart = cartWithAddon(order.cart, accepted);
    const quote = await this.ports.pricing.quoteForScope(ctx, scope, cart, THANK_YOU);
    const line = pricedAddonOf(quote, input, heldPiecesOf(order.cart, accepted));
    await target.appendLine(ctx, scope, order.id, line);
    await this.ports.events.offerApplied(ctx, scope, appliedPayloadOf(scope, { orderId: order.id, offerId }, line));
    return line;
  }

  /** The order, when it still takes an add-on. */
  private async editableOrder(
    target: OrderAddonTarget,
    ctx: OperationContext,
    scope: StoreScope,
    orderId: string,
  ): Promise<AddonOrder & { readonly id: Snowflake }> {
    if (!isSnowflake(orderId)) throw new OrderNotFoundForAddonError();
    const order = await target.orderOf(ctx, scope, orderId);
    if (order === undefined) throw new OrderNotFoundForAddonError();
    if (!ADDON_EDITABLE_ORDER_STATUSES.has(order.status)) throw new OrderNotEditableError();
    return { ...order, id: orderId };
  }
}
