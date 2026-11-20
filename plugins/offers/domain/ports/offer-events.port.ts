import type { OfferAppliedPayload } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/** Where the offers publish their domain events (D2509), in the transaction `ctx` carries (ADR 0016). */
export interface OfferEventsPort {
  /** Publishes `offer.applied`: `payload`'s offer gave `amount` DZD to its order. */
  offerApplied(ctx: OperationContext, scope: StoreScope, payload: OfferAppliedPayload): Promise<void>;
}
