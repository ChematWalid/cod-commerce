import type { TeamMemberDetails } from '../domain/member-details';
import { type MemberListPage, type MemberListQuery, newestFirst, pageOfMembers } from '../domain/member-listing';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMemberViewOptions } from '../domain/team-member';
import { MemberDetailsReader } from './member-details-reader';
import type { MemberReadPorts } from './member-read-ports';

/** The members list with its status tabs (brief step 3). */
export class ListMembersService {
  constructor(private readonly ports: MemberReadPorts) {}

  /**
   * One page of a tab, newest first, with every tab's count. Only members the actor reaches are listed or counted
   * (D211); reach is decided by rbac, so the filtering happens here rather than in SQL, over the business's live
   * members (a team is small: tens, not thousands).
   */
  async list(
    ctx: OperationContext,
    actor: TeamActor,
    query: MemberListQuery,
    options: TeamMemberViewOptions,
  ): Promise<MemberListPage<TeamMemberDetails>> {
    const live = newestFirst(await this.ports.members.listLive(ctx, actor.scope));
    return pageOfMembers(await new MemberDetailsReader(this.ports).inReach(ctx, actor, live, options), query);
  }
}
