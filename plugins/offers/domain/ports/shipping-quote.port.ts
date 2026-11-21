import type { QuoteDestination } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { ShippingQuoteResult } from '../snapshot';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/** One accepted cart line the delivery fee is computed for. */
export interface ShippingQuoteItem {
  readonly productId: CoreId;
  readonly variantId: CoreId;
  readonly quantity: number;
  /** The weight of one unit when the unit price resolver knows it (a pack's weight mode, D2441), for overweight fees. */
  readonly weightGrams?: number;
}

/** Where the order goes and what it carries. */
export type ShippingQuoteInput = Readonly<QuoteDestination> & { readonly items: readonly ShippingQuoteItem[] };

/**
 * The store's delivery fee for a destination (D2423). P3.S1 registers its fee table on `SHIPPING_QUOTE_REGISTRAR`;
 * until then every delivery is unresolved, with fees 0.
 */
export interface ShippingQuoteSource {
  quote(ctx: OperationContext, scope: StoreScope, input: ShippingQuoteInput): Promise<ShippingQuoteResult>;
}

/** Where P3.S1 registers its {@link ShippingQuoteSource} (injected as `SHIPPING_QUOTE_REGISTRAR`). */
export interface ShippingQuoteRegistrar {
  /** @throws {Error} when a source is already registered: two fee tables would silently disagree. */
  register(source: ShippingQuoteSource): void;
}
