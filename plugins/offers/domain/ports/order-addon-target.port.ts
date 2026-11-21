import type { QuoteRequest } from '@cod/shared';
import type { OrderUsage } from '../engine/order-usage';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * An order as the post-order add-on reads it (D2508): its status, the cart it was priced from and the uses it holds.
 */
export interface AddonOrder {
  readonly id: string;
  readonly status: string;
  /**
   * The order's cart as a quote request, so the add-on is priced against the order's own lines. Its `addons` must
   * hold every add-on line already on the order, summed per offer and variant, so a repeat is capped (D2532 b).
   */
  readonly cart: QuoteRequest;
  /**
   * The uses the order already holds, built with `orderUsageOf` from its stored `appliedOffers` and
   * `buyerOrdersBefore`, as for re-pricing (D2427, D2442). The pending order is already counted in the buyer's history
   * and its offers' usage, so the add-on quote gives them back: a first-order add-on stays offered on the buyer's
   * first order, and the order's own last allowed use refuses nothing (D2542).
   */
  readonly orderUsage: OrderUsage;
}

/** An add-on line the engine priced for an order (D2506, D2508): the order stores it as its own add-on line. */
export interface PricedAddonLine {
  readonly offerId: string;
  readonly kind: string;
  readonly productId: string;
  readonly variantId: string;
  /** The pieces priced, at most the offer's per-order cap. */
  readonly quantity: number;
  /** The variant's unit price before the add-on offer. */
  readonly originalPrice: number;
  /** What the buyer pays per piece. */
  readonly unitPrice: number;
  /** The order variant the add-on rides with, or null for an add-on offered on any order. */
  readonly parentVariantId: string | null;
}

/**
 * The orders a post-order add-on is appended to (D2508). P3.S4 registers its order source on
 * `ORDER_ADDON_TARGET_REGISTRAR`; until then every call is refused with `OrderAddonUnavailableError`.
 */
export interface OrderAddonTarget {
  /** The order of `scope`'s store with that id; `undefined` for an unknown or foreign one. */
  orderOf(ctx: OperationContext, scope: StoreScope, orderId: string): Promise<AddonOrder | undefined>;

  /**
   * Appends `line` to the order, in the transaction `ctx` carries. `line.quantity` is only the pieces added by this
   * call: an order that already holds the same offer and variant gets a second line (or merges it into the first).
   */
  appendLine(ctx: OperationContext, scope: StoreScope, orderId: string, line: PricedAddonLine): Promise<void>;
}

/** Where P3.S4 registers its {@link OrderAddonTarget} (injected as `ORDER_ADDON_TARGET_REGISTRAR`). */
export interface OrderAddonTargetRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(target: OrderAddonTarget): void;
}
