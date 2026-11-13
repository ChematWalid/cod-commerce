import { requestContextOf } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import type { OutboxAnnouncerPort } from '../application/ports';
import { OutboxTransactionRequiredError } from '../domain/errors';
import { OutboxEventsWrittenEvent } from './outbox-events-written.event';

/** {@link OutboxAnnouncerPort} on Vendure's event bus: the subscriber of the event runs after the commit (D104). */
@Injectable()
export class EventBusOutboxAnnouncer implements OutboxAnnouncerPort {
  constructor(private readonly eventBus: EventBus) {}

  async announce(scope: TenantScope, events: readonly { id: string; createdAt: string }[]): Promise<void> {
    const ctx = requestContextOf(scope);
    if (ctx === undefined) throw new OutboxTransactionRequiredError();
    await this.eventBus.publish(new OutboxEventsWrittenEvent(ctx, scope.businessId, events));
  }
}
