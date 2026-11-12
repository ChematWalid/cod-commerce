import { ACTIVITY_ACTIONS, type Snowflake } from '@cod/shared';
import { InvalidInputError, MemberNotActiveError, MemberSuspendedError } from '../domain/errors';
import {
  assertNotOwner,
  changedFieldsOf,
  editedGrantOf,
  type MemberEdit,
  touchesAccess,
  touchesPay,
} from '../domain/member-actions';
import type { TeamMemberPatch } from '../domain/ports/member-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { assertNotSelf } from '../domain/self-action';
import type { TeamActor } from '../domain/team-actor';
import { type TeamMemberView, type TeamMemberViewOptions, toTeamMemberView } from '../domain/team-member';
import { assertCommissionsExist, reachesGrant } from './invitation-guards';
import type { MemberActionPorts } from './member-action-ports';
import { commitMemberChange, type MemberChange, patchMember, recordAction } from './member-change';
import { administratorOf, liveMemberInReach, type MemberInReach } from './member-in-reach';

/** The pay fields of an edit, as a member patch. */
function payPatchOf(edit: MemberEdit): TeamMemberPatch {
  return {
    ...(edit.baseSalary === undefined ? {} : { baseSalary: edit.baseSalary }),
    ...(edit.commissionConfigIds === undefined ? {} : { commissionConfigIds: edit.commissionConfigIds }),
  };
}

/** "Edit a member": which member, and what changes. */
export interface UpdateMemberRequest {
  readonly id: Snowflake;
  readonly edit: MemberEdit;
}

/** "Edit a member": roles and stores through rbac (D204), salary and commissions on the member row. */
export class UpdateMemberService {
  constructor(private readonly ports: MemberActionPorts) {}

  /**
   * Applies the edit in one transaction under the business lock; a change of access signs the member out after commit.
   *
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   * @throws {SelfActionError} for an edit of the actor's own salary or commissions (D212).
   * @throws {CommissionNotFoundError} for a commission of no config of the business.
   * @throws {OwnerProtectedError} for a change of the business owner's roles or stores.
   * @throws {MemberSuspendedError} or {MemberNotActiveError} for an access change of an inactive or invited member.
   * @throws {InvalidInputError} for a grant beyond a store-limited actor's reach (D211).
   * @throws a rbac `DomainError` for a grant the actor may not make (D60).
   */
  async update(
    ctx: OperationContext,
    actor: TeamActor,
    { id, edit }: UpdateMemberRequest,
    view: TeamMemberViewOptions = {},
  ): Promise<TeamMemberView> {
    const member = await commitMemberChange(this.ports, ctx, actor, (transactional) =>
      this.updateIn(transactional, actor, id, edit),
    );
    return toTeamMemberView(member, view);
  }

  private async updateIn(
    ctx: OperationContext,
    actor: TeamActor,
    id: Snowflake,
    edit: MemberEdit,
  ): Promise<MemberChange> {
    const found = await liveMemberInReach(this.ports, ctx, actor, id);
    if (touchesPay(edit)) assertNotSelf(actor.administratorId, found.member);
    await assertCommissionsExist(this.ports, ctx, actor.scope, edit.commissionConfigIds ?? []);
    const signOut = touchesAccess(edit) ? await this.changeAccess(ctx, actor, found, edit) : undefined;
    const changed = await patchMember(this.ports, ctx, found.member, payPatchOf(edit));
    await recordAction(this.ports, ctx, actor, {
      member: changed,
      action: ACTIVITY_ACTIONS.MEMBER_UPDATED,
      summary: 'Member updated',
      changedFields: changedFieldsOf(edit),
    });
    return signOut === undefined ? { member: changed } : { member: changed, signOut };
  }

  /** Gives an active member the edited grant through rbac; the account to sign out. */
  private async changeAccess(
    ctx: OperationContext,
    actor: TeamActor,
    { member, grant, reach }: MemberInReach,
    edit: MemberEdit,
  ): Promise<number> {
    if (member.status === 'inactive') throw new MemberSuspendedError();
    if (member.status !== 'active') throw new MemberNotActiveError();
    assertNotOwner(member, await this.ports.owner.ownerAdministratorId(ctx, actor.scope));
    const next = editedGrantOf(grant, edit);
    if (!reachesGrant(reach, next)) throw new InvalidInputError();
    const administratorId = administratorOf(member);
    await this.ports.access.setAccess(ctx, actor, administratorId, next);
    return administratorId;
  }
}
