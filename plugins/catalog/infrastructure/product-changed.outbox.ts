import { type OutboxEventInput, OutboxService } from '@cod/plugin-platform-outbox';
import { DOMAIN_EVENT_NAMES, type ProductChangedPayload, type ProductChangeKind } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { CoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductEventsPort } from '../domain/ports/product-events.port';
import type { StoreScope } from '../domain/store-scope';
import { requestScope } from './request-scope';

/** The part of the platform outbox this adapter writes through. */
export type ProductChangedOutboxPort = Pick<OutboxService, 'add'>;

/** The `product.changed` outbox event of one product change (D2127): ids and the kind, nothing else. */
export function productChangedEvent(scope: StoreScope, productId: CoreId, change: ProductChangeKind): OutboxEventInput {
  const payload: ProductChangedPayload = { productId, storeId: scope.storeId, change };
  return { topic: DOMAIN_EVENT_NAMES.ProductChanged, aggregateId: productId, storeId: scope.storeId, payload };
}

/**
 * {@link ProductEventsPort} on the transactional outbox (ADR 0016, D2127): the event row is written in the saving
 * transaction, so the change and its event commit together.
 */
@Injectable()
export class OutboxProductEvents implements ProductEventsPort {
  constructor(@Inject(OutboxService) private readonly outbox: ProductChangedOutboxPort) {}

  async publish(ctx: OperationContext, scope: StoreScope, productId: CoreId, change: ProductChangeKind): Promise<void> {
    await this.outbox.add(requestScope(ctx, scope), productChangedEvent(scope, productId, change));
  }
}
