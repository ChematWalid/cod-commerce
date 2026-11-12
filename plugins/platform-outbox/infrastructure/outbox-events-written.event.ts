import { type RequestContext, VendureEvent } from '@vendure/core';

/**
 * Published inside the transaction that wrote the events. Vendure's event bus holds an event that carries a
 * transaction's context until that transaction ends and drops it on rollback, so a subscriber runs after commit only
 * (D104).
 */
export class OutboxEventsWrittenEvent extends VendureEvent {
  constructor(
    readonly ctx: RequestContext,
    readonly businessId: string,
    readonly events: readonly { readonly id: string; readonly createdAt: string }[],
  ) {
    super();
  }
}
