import type { QuoteAddonInput } from '@cod/shared';
import type { BuyerRef, CartAddon, PricedLine, PricingDestination } from '../cart';
import type { MergeableLine } from '../engine/merge-lines';
import type { PricingSnapshot } from '../snapshot';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * The cart a snapshot is loaded for: lines already merged by variant (D2428), destination, buyer, codes and the
 * add-ons the buyer accepted (D2506).
 */
export interface SnapshotRequest {
  readonly lines: readonly MergeableLine[];
  readonly destination: PricingDestination;
  readonly buyer: BuyerRef | null;
  readonly codes: readonly string[];
  readonly addons: readonly QuoteAddonInput[];
}

/**
 * The snapshot, the lines the gate accepted at their unit price, the variants it refused (D2425) and the add-ons with
 * their gated price, or none when the gate refused the variant: a refused add-on never makes the cart unavailable.
 */
export interface LoadedCart {
  readonly snapshot: PricingSnapshot;
  readonly lines: readonly PricedLine[];
  readonly unavailableVariantIds: readonly string[];
  readonly addons: readonly CartAddon[];
}

/**
 * Where the pricing service reads what one quote prices (D2424), injected as `PRICING_SNAPSHOT_SOURCE`. The store
 * loader answers it today; P3.S3 binds a caching adapter in `infrastructure/` that wraps the loader under the same
 * token, without touching `application/`.
 */
export interface PricingSnapshotSource {
  /** The snapshot of `request` in `scope`: a refused variant is reported in `unavailableVariantIds`, never thrown. */
  load(ctx: OperationContext, scope: StoreScope, request: SnapshotRequest): Promise<LoadedCart>;
}
