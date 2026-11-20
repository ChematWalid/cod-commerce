import type { OfferAppliedPayload } from '@cod/shared';
import type { OfferEventsPort } from '../../domain/ports/offer-events.port';
import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';

/** The offer events port that records every `offer.applied` it is given. */
export class RecordingOfferEvents implements OfferEventsPort {
  readonly applied: { ctx: OperationContext; scope: StoreScope; payload: OfferAppliedPayload }[] = [];

  offerApplied(ctx: OperationContext, scope: StoreScope, payload: OfferAppliedPayload): Promise<void> {
    this.applied.push({ ctx, scope, payload });
    return Promise.resolve();
  }
}
