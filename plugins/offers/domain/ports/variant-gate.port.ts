import type { CoreId } from '../core-id';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/** A variant the store's channel sells: its product, as the store holds it, and its channel list price (D2423). */
export interface GatedVariant {
  readonly variantId: CoreId;
  readonly productId: CoreId;
  /** Whole DZD, before any resolver or offer. */
  readonly listPrice: number;
}

/**
 * The only judge of which cart variants a quote may price (D2423): it runs before every unit-price resolver and drops
 * unknown, foreign, disabled, deleted and merchant-hidden variants (catalog `isHidden`, D2165), those of a draft
 * product and those with no price in the store channel. The caller has already proved that
 * `ctx` is on the store's own channel (D2408 `isChannelOf`).
 */
export interface VariantGate {
  /** The accepted variants among `variantIds`, by variant id; a refused id is simply absent. */
  accept(
    ctx: OperationContext,
    scope: StoreScope,
    variantIds: readonly CoreId[],
  ): Promise<ReadonlyMap<string, GatedVariant>>;
}
