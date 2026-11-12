import { type TenantScope } from '@cod/shared';
import { InvitationInvalidError } from '../domain/errors';
import { invitationStateOf } from '../domain/invitation';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamInvitationPorts } from './invitation-ports';

/** What the accept page shows before the invitee chooses a password. */
export interface InvitationPreview {
  readonly email: string;
  readonly businessName: string;
  readonly inviterName: string | null;
  readonly expiresAt: Date;
}

/** Shows an open invitation to the holder of its token, and nothing about any other (D213). */
export class PreviewInvitationService {
  constructor(private readonly ports: TeamInvitationPorts) {}

  /** @throws {InvitationInvalidError} alike for an unknown, revoked, accepted or expired token: no token oracle. */
  async preview(ctx: OperationContext, token: string): Promise<InvitationPreview> {
    const location = await this.ports.lookup.locate(ctx, this.ports.tokens.hash(token));
    if (location === undefined) throw new InvitationInvalidError();
    const scope: TenantScope = { businessId: location.businessId };
    return this.ports.transaction.run(ctx, scope, async (transactional) => {
      const { invitations, members, names, clock } = this.ports;
      const invitation = await invitations.findById(transactional, scope, location.invitationId);
      if (invitation === undefined || invitationStateOf(invitation, clock.now()) !== 'open') {
        throw new InvitationInvalidError();
      }
      const member = await members.findById(transactional, scope, invitation.memberId);
      if (member?.status !== 'invited' || member.removedAt !== null) throw new InvitationInvalidError();
      return {
        email: member.email,
        businessName: await names.businessName(transactional, scope),
        inviterName: await names.administratorName(transactional, scope, invitation.invitedByAdministratorId),
        expiresAt: invitation.expiresAt,
      };
    });
  }
}
