import { type TeamMemberDetails, grantOfMember, toMemberDetails } from '../domain/member-details';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMember, TeamMemberViewOptions } from '../domain/team-member';
import { reachesGrant } from './invitation-guards';
import type { MemberReadPorts } from './member-read-ports';

/** Builds the details of members as the actor may see them. */
export class MemberDetailsReader {
  constructor(private readonly ports: MemberReadPorts) {}

  /**
   * The details of those of `members` the actor reaches (D211), in the order given. Every name and grant is read
   * once for the whole business, whatever the number of members.
   */
  async inReach(
    ctx: OperationContext,
    actor: TeamActor,
    members: readonly TeamMember[],
    options: TeamMemberViewOptions,
  ): Promise<TeamMemberDetails[]> {
    const { ports } = this;
    const { scope } = actor;
    const invitedIds = members.filter((member) => member.status === 'invited').map((member) => member.id);
    const [reach, held, roleNames, storeNames, invitations] = await Promise.all([
      ports.access.reachOf(ctx, actor),
      ports.directory.accessOfHolders(ctx, scope),
      ports.directory.roleNames(ctx, scope),
      ports.directory.storeNames(ctx, scope),
      ports.invitations.latestOfMembers(ctx, scope, invitedIds),
    ]);
    const now = ports.clock.now();
    return members.flatMap((member) => {
      const invitation = invitations.get(member.id);
      const access = member.administratorId === null ? undefined : held.get(member.administratorId);
      const grant = grantOfMember(member, invitation, access);
      if (!reachesGrant(reach, grant)) return [];
      return [toMemberDetails({ member, grant, invitation, roleNames, storeNames, now }, options)];
    });
  }
}
