import { type OutboxEventInput, OutboxService } from '@cod/plugin-platform-outbox';
import { type CollectionChangedPayload, type CollectionChangeKind, DOMAIN_EVENT_NAMES } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { CollectionEventsPort } from '../domain/ports/collection-events.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { requestScope } from './request-scope';

/** The part of the platform outbox this adapter writes through. */
export type CollectionChangedOutboxPort = Pick<OutboxService, 'add'>;

/** The `collection.changed` outbox event of one change (D2335): ids and the kind, nothing else. */
export function collectionChangedEvent(
  scope: StoreScope,
  collectionId: string,
  change: CollectionChangeKind,
): OutboxEventInput {
  const payload: CollectionChangedPayload = { collectionId, storeId: scope.storeId, change };
  return { topic: DOMAIN_EVENT_NAMES.CollectionChanged, aggregateId: collectionId, storeId: scope.storeId, payload };
}

/**
 * {@link CollectionEventsPort} on the transactional outbox (ADR 0016): the event row is written in the saving
 * transaction, so the change and its event commit together.
 */
@Injectable()
export class OutboxCollectionEvents implements CollectionEventsPort {
  constructor(@Inject(OutboxService) private readonly outbox: CollectionChangedOutboxPort) {}

  async publish(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
    change: CollectionChangeKind,
  ): Promise<void> {
    await this.outbox.add(requestScope(ctx, scope), collectionChangedEvent(scope, collectionId, change));
  }
}
