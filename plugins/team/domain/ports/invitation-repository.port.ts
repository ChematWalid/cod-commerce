import type { Snowflake, TenantScope } from '@cod/shared';
import type { Invitation, IssuedInvitation } from '../invitation';
import type { OperationContext } from './operation-context';

/** What a use case may change on an invitation; a resend replaces the token hash (D205). */
export type InvitationPatch = Partial<
  Pick<IssuedInvitation, 'tokenHash' | 'expiresAt' | 'lastSentAt' | 'resendCount' | 'revokedAt' | 'acceptedAt'>
>;

/**
 * Where invitations are kept, confined to `scope.businessId`. Reads never return the token hash; only the accept
 * lookup reads it (D208).
 */
export interface InvitationRepositoryPort {
  /** Stores a new invitation with its token hash; rejects a hash already stored, in any business. */
  insert(ctx: OperationContext, scope: TenantScope, invitation: IssuedInvitation): Promise<void>;

  /** The invitation `id`, or `undefined`. */
  findById(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<Invitation | undefined>;

  /** The member's most recent invitation, or `undefined`. */
  latestOfMember(ctx: OperationContext, scope: TenantScope, memberId: Snowflake): Promise<Invitation | undefined>;

  /**
   * Accepts the open invitation with that token hash at `now`, in one conditional write (D213): `false` when no
   * invitation of the business with that hash is open, so of two parallel accepts only one gets `true`.
   */
  claim(ctx: OperationContext, scope: TenantScope, tokenHash: string, now: Date): Promise<boolean>;

  /** How many invitations of the business are open at `now`: neither accepted, revoked nor expired. */
  countOpen(ctx: OperationContext, scope: TenantScope, now: Date): Promise<number>;

  /** Applies `patch` to the invitation `id`; `false` when the business has no such invitation. */
  update(ctx: OperationContext, scope: TenantScope, id: Snowflake, patch: InvitationPatch): Promise<boolean>;
}
