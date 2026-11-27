import type { BusinessId, Snowflake, StoreId } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** The store settings that name a record another plugin owns (D3111). */
export const STORE_REFERENCE_KINDS = ['deliveryFeeGroup', 'carrier'] as const;

/** One of the {@link STORE_REFERENCE_KINDS}. */
export type StoreReferenceKind = (typeof STORE_REFERENCE_KINDS)[number];

/** The store a reference is checked for: the store being changed, never the session's active store. */
export interface StoreReferenceScope {
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
}

/**
 * Whether a referenced record belongs to the store, registered by the plugin that owns the record (delivery-pricing
 * for fee groups, P5.S1 for carriers). Tenancy cannot import those plugins (arch rules), so they fill this seam.
 */
export interface StoreReferenceCheck {
  readonly kind: StoreReferenceKind;
  /**
   * True when `id` names a record of `scope`'s store. It runs inside the caller's transaction (`ctx`) and holds the
   * record `FOR SHARE` until it ends, so a concurrent delete cannot leave the store pointing at nothing.
   */
  exists(ctx: OperationContext, scope: StoreReferenceScope, id: Snowflake): Promise<boolean>;
}
