import {
  ACTIVITY_ACTIONS,
  FEATURE_KEYS,
  type InviteMemberCommand,
  MAX_PENDING_INVITATIONS,
  requireFeature,
} from '@cod/shared';
import { EmailAlreadyMemberError, TooManyPendingError } from '../domain/errors';
import { grantOf, invitedMemberOf, issuedInvitationOf } from '../domain/new-invitation';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import {
  emailKeyOf,
  type TeamMember,
  type TeamMemberView,
  type TeamMemberViewOptions,
  toTeamMemberView,
} from '../domain/team-member';
import type { TeamInvitationPorts } from './invitation-ports';
import { assertCommissionsExist, assertGrantAllowed, mailInvitation, recordMemberActivity } from './invitation-guards';

/** Invites a person by email with the roles, stores and pay terms they get on accept (brief step 2). */
export class InviteMemberService {
  constructor(private readonly ports: TeamInvitationPorts) {}

  /**
   * Stores an invited member and its invitation (the token's hash only), records the activity and mails the link
   * once the transaction commits (D205).
   *
   * @throws {TooManyPendingError} when the business holds {@link MAX_PENDING_INVITATIONS} open invitations.
   * @throws a rbac `DomainError` or {@link InvalidInputError} for a grant the actor could not give (D208, D211).
   * @throws {EmailAlreadyMemberError} when a live member of the business has the address.
   * @throws {CommissionNotFoundError} for a commission config the business does not have.
   */
  async invite(
    ctx: OperationContext,
    actor: TeamActor,
    command: InviteMemberCommand,
    view: TeamMemberViewOptions = {},
  ): Promise<TeamMemberView> {
    await requireFeature(FEATURE_KEYS.TeamSeats, actor.scope);
    const member = await this.ports.transaction.run(ctx, actor.scope, (transactional) =>
      this.inviteIn(transactional, actor, command),
    );
    return toTeamMemberView(member, view);
  }

  private async inviteIn(ctx: OperationContext, actor: TeamActor, command: InviteMemberCommand): Promise<TeamMember> {
    const { lock, invitations, members, clock, ids, tokens } = this.ports;
    const { scope } = actor;
    await lock.acquire(ctx, scope);
    const now = clock.now();
    if ((await invitations.countOpen(ctx, scope, now)) >= MAX_PENDING_INVITATIONS) throw new TooManyPendingError();
    await assertGrantAllowed(this.ports, ctx, actor, grantOf(command));
    if ((await members.findLiveByEmailKey(ctx, scope, emailKeyOf(command.email))) !== undefined) {
      throw new EmailAlreadyMemberError();
    }
    await assertCommissionsExist(this.ports, ctx, scope, command.commissionConfigIds);
    const invitedBy = actor.administratorId;
    const member = invitedMemberOf({ id: ids.next(), scope, command, invitedByAdministratorId: invitedBy, now });
    await members.insert(ctx, scope, member);
    const token = tokens.newToken();
    const tokenHash = tokens.hash(token);
    const invitation = issuedInvitationOf({
      id: ids.next(),
      member,
      command,
      tokenHash,
      invitedByAdministratorId: invitedBy,
      now,
    });
    await invitations.insert(ctx, scope, invitation);
    await recordMemberActivity(this.ports, ctx, {
      scope,
      actorAdministratorId: actor.administratorId,
      origin: actor,
      action: ACTIVITY_ACTIONS.MEMBER_INVITED,
      summary: 'Member invited',
      member,
    });
    await mailInvitation(this.ports, ctx, { member, invitation, token });
    return member;
  }
}
