import type { QuoteRequest } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/** An order as the post-order add-on reads it (D2508): its status and the cart it was priced from. */
export interface AddonOrder {
  readonly id: string;
  readonly status: string;
  /** The order's cart as a quote request, so the add-on is priced against the order's own lines. */
  readonly cart: QuoteRequest;
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

  /** Appends `line` to the order, in the transaction `ctx` carries. */
  appendLine(ctx: OperationContext, scope: StoreScope, orderId: string, line: PricedAddonLine): Promise<void>;
}

/** Where P3.S4 registers its {@link OrderAddonTarget} (injected as `ORDER_ADDON_TARGET_REGISTRAR`). */
export interface OrderAddonTargetRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(target: OrderAddonTarget): void;
}
