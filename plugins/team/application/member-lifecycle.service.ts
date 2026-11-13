import { ACTIVITY_ACTIONS, DomainError, RBAC_ERROR_CODES, type Snowflake } from '@cod/shared';
import { AccessUnavailableError, MemberNotActiveError } from '../domain/errors';
import { assertMaxOpenOrders, assertNotOwner, clearingGrantOf } from '../domain/member-actions';
import type { MemberGrant } from '../domain/member-grant';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import { type TeamMemberView, type TeamMemberViewOptions, toTeamMemberView } from '../domain/team-member';
import type { MemberActionPorts } from './member-action-ports';
import { commitMemberChange, type MemberChange, patchMember, recordAction } from './member-change';
import { administratorOf, liveMemberInReach } from './member-in-reach';

/**
 * rbac's refusals that say a deactivated member's former access cannot be given back as it was: a role or store gone
 * since (D214), or a grant the actor may no longer make. Reactivate answers them all with `team.access-unavailable`.
 */
const ACCESS_GONE_CODES: ReadonlySet<string> = new Set([
  RBAC_ERROR_CODES.ROLE_NOT_FOUND,
  RBAC_ERROR_CODES.MEMBER_NOT_FOUND,
  RBAC_ERROR_CODES.STORE_NOT_ACCESSIBLE,
  RBAC_ERROR_CODES.STORE_ACCESS_INVALID,
  RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED,
]);

/** "Set limit" on a member: the most open orders it may hold, `null` for no limit. */
export interface SetLimitCommand {
  readonly id: Snowflake;
  readonly maxOpenOrders: number | null;
}

/** "Stop receiving orders" or "Resume" on a member. */
export interface SetReceivingCommand {
  readonly id: Snowflake;
  readonly receivingOrders: boolean;
}

/** The limit, the order intake and the active state of a member (brief step 4, D204). */
export class MemberLifecycleService {
  constructor(private readonly ports: MemberActionPorts) {}

  /**
   * Sets the most open orders the member may hold; `null` clears the limit.
   *
   * @throws {InvalidInputError} for zero, a negative or a value above the cap.
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   */
  async setLimit(
    ctx: OperationContext,
    actor: TeamActor,
    { id, maxOpenOrders }: SetLimitCommand,
    view: TeamMemberViewOptions = {},
  ): Promise<TeamMemberView> {
    assertMaxOpenOrders(maxOpenOrders);
    const member = await commitMemberChange(this.ports, ctx, actor, async (transactional) => {
      const found = await liveMemberInReach(this.ports, transactional, actor, id);
      const changed = await patchMember(this.ports, transactional, found.member, { maxOpenOrders });
      await recordAction(this.ports, transactional, actor, {
        member: changed,
        action: ACTIVITY_ACTIONS.MEMBER_UPDATED,
        summary: 'Member order limit changed',
        changedFields: ['maxOpenOrders'],
      });
      return { member: changed };
    });
    return toTeamMemberView(member, view);
  }

  /**
   * Stops or resumes offering the member new orders; the status stays as it is.
   *
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   */
  async setReceiving(
    ctx: OperationContext,
    actor: TeamActor,
    { id, receivingOrders }: SetReceivingCommand,
    view: TeamMemberViewOptions = {},
  ): Promise<TeamMemberView> {
    const member = await commitMemberChange(this.ports, ctx, actor, async (transactional) => {
      const found = await liveMemberInReach(this.ports, transactional, actor, id);
      const changed = await patchMember(this.ports, transactional, found.member, { receivingOrders });
      await recordAction(this.ports, transactional, actor, {
        member: changed,
        action: ACTIVITY_ACTIONS.MEMBER_UPDATED,
        summary: receivingOrders ? 'Member resumed receiving orders' : 'Member stopped receiving orders',
        changedFields: ['receivingOrders'],
      });
      return { member: changed };
    });
    return toTeamMemberView(member, view);
  }

  /**
   * Snapshots the member's access into `suspendedAccess`, withdraws every role in rbac and signs it out (D204).
   *
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   * @throws {MemberNotActiveError} for a member that is not active.
   * @throws {OwnerProtectedError} for the business owner.
   * @throws a rbac `DomainError` for a member the actor may not change (D60).
   */
  async deactivate(
    ctx: OperationContext,
    actor: TeamActor,
    id: Snowflake,
    view: TeamMemberViewOptions = {},
  ): Promise<TeamMemberView> {
    const member = await commitMemberChange(this.ports, ctx, actor, (transactional) =>
      this.deactivateIn(transactional, actor, id),
    );
    return toTeamMemberView(member, view);
  }

  /**
   * Gives a deactivated member its former access back from the snapshot and clears it (D204). An active member is
   * left as it is.
   *
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   * @throws {MemberNotActiveError} for an invited member.
   * @throws {AccessUnavailableError} when rbac cannot give the former access back; the member stays inactive (D214).
   */
  async reactivate(
    ctx: OperationContext,
    actor: TeamActor,
    id: Snowflake,
    view: TeamMemberViewOptions = {},
  ): Promise<TeamMemberView> {
    const member = await commitMemberChange(this.ports, ctx, actor, (transactional) =>
      this.reactivateIn(transactional, actor, id),
    );
    return toTeamMemberView(member, view);
  }

  private async deactivateIn(ctx: OperationContext, actor: TeamActor, id: Snowflake): Promise<MemberChange> {
    const { member, grant, reach } = await liveMemberInReach(this.ports, ctx, actor, id);
    if (member.status !== 'active') throw new MemberNotActiveError();
    assertNotOwner(member, await this.ports.owner.ownerAdministratorId(ctx, actor.scope));
    const administratorId = administratorOf(member);
    const changed = await patchMember(this.ports, ctx, member, { status: 'inactive', suspendedAccess: grant });
    if (grant.roleIds.length > 0) {
      await this.ports.access.setAccess(ctx, actor, administratorId, clearingGrantOf(grant, reach.allStores));
    }
    await recordAction(this.ports, ctx, actor, {
      member: changed,
      action: ACTIVITY_ACTIONS.MEMBER_DEACTIVATED,
      summary: 'Member deactivated',
      changedFields: ['status'],
    });
    return { member: changed, signOut: administratorId };
  }

  private async reactivateIn(ctx: OperationContext, actor: TeamActor, id: Snowflake): Promise<MemberChange> {
    const { member, grant } = await liveMemberInReach(this.ports, ctx, actor, id);
    if (member.status === 'active') return { member };
    if (member.status !== 'inactive') throw new MemberNotActiveError();
    const administratorId = administratorOf(member);
    // Active first: rbac asks Team whether the member is suspended before it grants a role (D204).
    const changed = await patchMember(this.ports, ctx, member, { status: 'active', suspendedAccess: null });
    if (grant.roleIds.length > 0) await this.restore(ctx, actor, administratorId, grant);
    await recordAction(this.ports, ctx, actor, {
      member: changed,
      action: ACTIVITY_ACTIONS.MEMBER_REACTIVATED,
      summary: 'Member reactivated',
      changedFields: ['status'],
    });
    return { member: changed, signOut: administratorId };
  }

  private async restore(
    ctx: OperationContext,
    actor: TeamActor,
    administratorId: number,
    snapshot: MemberGrant,
  ): Promise<void> {
    try {
      await this.ports.access.setAccess(ctx, actor, administratorId, snapshot);
    } catch (error: unknown) {
      if (error instanceof DomainError && ACCESS_GONE_CODES.has(error.code)) throw new AccessUnavailableError();
      throw error;
    }
  }
}
