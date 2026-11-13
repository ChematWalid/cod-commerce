import type { TenantScope } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { VendureEvent } from '@vendure/core';
import type { ActivityEntryInput } from '../domain/activity';

/**
 * Publish this to record an activity row in the publisher's own transaction (D66): the row commits or rolls back
 * with the caller's work. The business is the one `@requirePermission` resolved for `ctx`, so the entry names no
 * scope. A failure to record rejects `EventBus.publish`.
 *
 * `scope` is only for a public handler, where no tenant guard ran: Team's invitation accept, which found the business
 * by the invitation's token (D208). A handler behind `@requirePermission` leaves it out.
 */
export class ActivityRecordEvent extends VendureEvent {
  constructor(
    readonly ctx: RequestContext,
    readonly entry: Omit<ActivityEntryInput, 'scope'>,
    readonly scope?: TenantScope,
  ) {
    super();
  }
}
