import type { CoreId } from '../core-id';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * The context a resolver receives: the offers' {@link OperationContext}, a Vendure `RequestContext` at runtime. Typed
 * `object` so a sibling resolver may declare its framework context as is: P2.S2's pack resolver takes
 * `RequestContext` and registers without an adapter (D2441).
 */
export type ResolverContext = object;

/** A line the variant gate accepted: its variant and the product the gate read for it (D2423). */
export interface GatedLine {
  readonly productId: CoreId;
  readonly variantId: CoreId;
}

/** A resolver's unit price for one line: whole DZD before offers (ADR 0004). */
export interface ResolverPrice {
  /** The price the line is sold at; it becomes the engine's `PricedLine.originalPrice` (the price before offers). */
  readonly unitPrice: number;
  /**
   * Display only: the price shown struck through (the list price for a plain variant, the components' sum for a
   * pack). The engine never prices from it, despite sharing a name with `PricedLine.originalPrice`.
   */
  readonly originalPrice: number;
  /** Who priced the line: the resolver's key; `'variant'` is reserved for the list price and refused from a resolver. */
  readonly source: string;
  /** The weight one unit ships at, when the resolver knows it (a pack's weight mode); feeds `ShippingQuoteItem`. */
  readonly weightGrams?: number;
}

/**
 * Re-prices some gated lines (a pack, P2.S2), registered on `UNIT_PRICE_RESOLVER_REGISTRAR` (D2423, D2441). It only
 * answers prices: it cannot add a line, make a refused variant available or change a line's product.
 */
export interface UnitPriceResolver {
  /** Unique among the registered resolvers, e.g. `'pack'`. */
  readonly key: string;

  /** Prices of the lines it owns, by variant id; a line it leaves out falls through to the next resolver. */
  resolve(
    ctx: ResolverContext,
    scope: StoreScope,
    lines: readonly GatedLine[],
  ): Promise<ReadonlyMap<string, ResolverPrice>>;
}

/** Where another plugin adds a {@link UnitPriceResolver} (injected as `UNIT_PRICE_RESOLVER_REGISTRAR`). */
export interface UnitPriceResolverRegistrar {
  /** Resolvers run in registration order. @throws {Error} when a resolver of the same key is already registered. */
  register(resolver: UnitPriceResolver): void;
}

/** The unit price of an accepted line, with the variant and product the gate read, never a resolver's (D2423). */
export interface ResolvedUnitPrice extends ResolverPrice {
  readonly variantId: CoreId;
  readonly productId: CoreId;
}

/** Unit prices of cart variants as the pricing snapshot reads them (injected as `UNIT_PRICE_RESOLVER`). */
export interface UnitPriceSource {
  /** Prices of the variants the gate accepts among `variantIds`; a refused variant is absent (unavailable). */
  pricesOf(
    ctx: OperationContext,
    scope: StoreScope,
    variantIds: readonly CoreId[],
  ): Promise<ReadonlyMap<string, ResolvedUnitPrice>>;
}
