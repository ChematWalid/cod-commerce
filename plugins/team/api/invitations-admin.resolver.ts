import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withTeamErrors } from './error-mapping';
import { InvitationActions } from './invitation-actions';
import type { TeamMemberDto } from './member-dto';

/** Inviting, resending and revoking on the Admin API; the same actions as the REST routes. */
@Resolver()
export class InvitationsAdminResolver {
  constructor(private readonly actions: InvitationActions) {}

  @Mutation()
  @requirePermission('team.members.invite')
  inviteMember(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<TeamMemberDto> {
    return withTeamErrors(() => this.actions.invite(ctx, input));
  }

  @Mutation()
  @requirePermission('team.members.invite')
  resendInvitation(@Ctx() ctx: RequestContext, @Args('memberId') memberId: string): Promise<TeamMemberDto> {
    return withTeamErrors(() => this.actions.resend(ctx, memberId));
  }

  @Mutation()
  @requirePermission('team.members.invite')
  revokeInvitation(@Ctx() ctx: RequestContext, @Args('memberId') memberId: string): Promise<boolean> {
    return withTeamErrors(async () => {
      await this.actions.revoke(ctx, memberId);
      return true;
    });
  }
}
