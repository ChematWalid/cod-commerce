import { ACTIVITY_ACTIONS, type Snowflake } from '@cod/shared';
import { MemberNotFoundError } from '../domain/errors';
import { assertNotOwner, clearingGrantOf } from '../domain/member-actions';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { MemberActionPorts } from './member-action-ports';
import { commitMemberChange, type MemberChange, patchMember, recordAction } from './member-change';
import { administratorOf, liveMemberInReach } from './member-in-reach';
import { assertMayActOnMember } from './member-privilege';
import type { RevokeInvitationService } from './revoke-invitation.service';

/** Takes a member off the team: its account goes and its address can be invited again (D204). */
export class RemoveMemberService {
  constructor(
    private readonly ports: MemberActionPorts,
    private readonly revoker: Pick<RevokeInvitationService, 'revoke'>,
  ) {}

  /**
   * Withdraws the member's access, soft-deletes its account and marks it removed, then signs it out after commit. An
   * invited member, which has no account yet, is revoked instead.
   *
   * @throws {MemberNotFoundError} for no such live member or one out of the actor's reach (D211).
   * @throws {OwnerProtectedError} for the business owner.
   * @throws a rbac `DomainError` for a member the actor may not change (D60).
   */
  async remove(ctx: OperationContext, actor: TeamActor, id: Snowflake): Promise<void> {
    const seen = await this.ports.members.findById(ctx, actor.scope, id);
    if (seen?.status === 'invited' && seen.removedAt === null) {
      await this.revoker.revoke(ctx, actor, id);
      return;
    }
    await commitMemberChange(this.ports, ctx, actor, (transactional) => this.removeIn(transactional, actor, id));
  }

  private async removeIn(ctx: OperationContext, actor: TeamActor, id: Snowflake): Promise<MemberChange> {
    const { member, grant, reach } = await liveMemberInReach(this.ports, ctx, actor, id);
    // Became invited between the two reads is impossible; an account is what this path removes.
    if (member.status === 'invited') throw new MemberNotFoundError();
    assertNotOwner(member, await this.ports.owner.ownerAdministratorId(ctx, actor.scope));
    const administratorId = administratorOf(member);
    if (member.status === 'active' && grant.roleIds.length > 0) {
      await this.ports.access.setAccess(ctx, actor, administratorId, clearingGrantOf(grant, reach.allStores));
    } else {
      // rbac holds no role of a deactivated member, so setAccess would judge nothing: judge its snapshot instead (D60).
      await assertMayActOnMember(this.ports, ctx, actor, grant);
    }
    await this.ports.accounts.softDelete(ctx, actor.scope, administratorId);
    const changed = await patchMember(this.ports, ctx, member, {
      removedAt: this.ports.clock.now(),
      suspendedAccess: null,
    });
    await recordAction(this.ports, ctx, actor, {
      member: changed,
      action: ACTIVITY_ACTIONS.MEMBER_REMOVED,
      summary: 'Member removed',
      changedFields: ['status'],
    });
    return { member: changed, signOut: administratorId };
  }
}
