import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withTeamErrors } from './error-mapping';
import { MemberReadActions } from './member-read-actions';
import type { TeamMemberDetailsDto, TeamMemberPageDto } from './member-dto';

/** The members list and one member on the Admin API; the same reads as the REST routes. */
@Resolver()
export class MembersReadResolver {
  constructor(private readonly reads: MemberReadActions) {}

  /** One page of the business's members within the caller's store reach, by tab and search (team.members.view). */
  @Query()
  @requirePermission('team.members.view')
  teamMembers(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<TeamMemberPageDto> {
    return withTeamErrors(() => this.reads.list(ctx, input));
  }

  /** One member within the caller's store reach (team.members.view); `team.member-not-found` otherwise. */
  @Query()
  @requirePermission('team.members.view')
  teamMember(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<TeamMemberDetailsDto> {
    return withTeamErrors(() => this.reads.get(ctx, id));
  }
}
