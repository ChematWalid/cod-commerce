import type { StoreScope } from '../store-scope';

/** A line a pricing pipeline asks a unit price for. */
export interface PriceLine {
  readonly productId: string;
  readonly variantId: string;
}

/** The unit price of one pack variant, computed live (D2204). */
export interface PackUnitPrice {
  readonly unitPrice: number;
  /** The components' sum before the pack discount. */
  readonly originalPrice: number;
  readonly source: 'pack';
  readonly weightGrams: number;
}

/**
 * The structural mirror of P2.S4's draft `UnitPriceResolver` (D2204): P2.S4 defines the port and registers the pack
 * resolver; whichever merges second wires the line. `Ctx` is the framework context the pipeline passes.
 */
export interface PackPriceResolverShape<Ctx> {
  readonly key: 'pack';
  /** Unit prices by variant id; a line of no live pack of the scope is left out. */
  resolve(ctx: Ctx, scope: StoreScope, lines: readonly PriceLine[]): Promise<ReadonlyMap<string, PackUnitPrice>>;
}
