import type { BusinessId } from '@cod/shared';
import { type RequestContext, VendureEvent } from '@vendure/core';

/** A business gained a store, so what its all-stores members can reach changed. */
export class StoreAccessChangedEvent extends VendureEvent {
  constructor(
    readonly ctx: RequestContext,
    readonly businessId: BusinessId,
  ) {
    super();
  }
}
