import { type OutboxEventInput, OutboxService } from '@cod/plugin-platform-outbox';
import { DOMAIN_EVENT_NAMES, type OfferAppliedPayload } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { OfferEventsPort } from '../domain/ports/offer-events.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { requestScope } from './request-scope';

/** The part of the platform outbox this adapter writes through. */
export type OfferAppliedOutboxPort = Pick<OutboxService, 'add'>;

/** The `offer.applied` outbox event of one applied offer (D2509): ids, the kind and the amount, nothing else. */
export function offerAppliedEvent(scope: StoreScope, payload: OfferAppliedPayload): OutboxEventInput {
  return { topic: DOMAIN_EVENT_NAMES.OfferApplied, aggregateId: payload.offerId, storeId: scope.storeId, payload };
}

/**
 * {@link OfferEventsPort} on the transactional outbox (ADR 0016, D2509): the event row is written in the order's
 * transaction, so the appended add-on and its event commit together.
 */
@Injectable()
export class OutboxOfferEvents implements OfferEventsPort {
  constructor(@Inject(OutboxService) private readonly outbox: OfferAppliedOutboxPort) {}

  async offerApplied(ctx: OperationContext, scope: StoreScope, payload: OfferAppliedPayload): Promise<void> {
    await this.outbox.add(requestScope(ctx, scope), offerAppliedEvent(scope, payload));
  }
}
