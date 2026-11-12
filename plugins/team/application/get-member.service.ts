import type { Snowflake } from '@cod/shared';
import { MemberNotFoundError } from '../domain/errors';
import type { TeamMemberDetails } from '../domain/member-details';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMemberViewOptions } from '../domain/team-member';
import { MemberDetailsReader } from './member-details-reader';
import type { MemberReadPorts } from './member-read-ports';

/** One member of the actor's business. */
export class GetMemberService {
  constructor(private readonly ports: MemberReadPorts) {}

  /**
   * The live member `id`, if the actor reaches it.
   *
   * @throws {MemberNotFoundError} for no such live member of the business, or one out of the actor's reach (D211).
   */
  async get(
    ctx: OperationContext,
    actor: TeamActor,
    id: Snowflake,
    options: TeamMemberViewOptions,
  ): Promise<TeamMemberDetails> {
    const member = await this.ports.members.findById(ctx, actor.scope, id);
    if (member === undefined || member.removedAt !== null) throw new MemberNotFoundError();
    const [details] = await new MemberDetailsReader(this.ports).inReach(ctx, actor, [member], options);
    if (details === undefined) throw new MemberNotFoundError();
    return details;
  }
}
