import type { BusinessId, Snowflake } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** Where a token's invitation lives: the only fact the public routes learn before they enter that business. */
export interface InvitationLocation {
  readonly businessId: BusinessId;
  readonly invitationId: Snowflake;
}

/**
 * Finds an invitation by its token hash across businesses: the one unscoped read of Team (D208). Everything after it
 * runs in the found invitation's own business.
 */
export interface InvitationLookupPort {
  locate(ctx: OperationContext, tokenHash: string): Promise<InvitationLocation | undefined>;
}
