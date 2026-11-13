import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withTeamErrors } from './error-mapping';
import { MemberActions } from './member-actions';
import type { TeamMemberDto } from './member-dto';

/** The member actions on the Admin API; the same actions as the REST routes. */
@Resolver()
export class MemberActionsResolver {
  constructor(private readonly actions: MemberActions) {}

  /** Edits a member's roles, stores, salary or commissions (team.members.edit); refuses one's own pay (D212). */
  @Mutation()
  @requirePermission('team.members.edit')
  updateTeamMember(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('input') input: unknown,
  ): Promise<TeamMemberDto> {
    return withTeamErrors(() => this.actions.update(ctx, id, input));
  }

  /** Sets or clears a member's open-orders limit (team.members.edit). */
  @Mutation()
  @requirePermission('team.members.edit')
  setTeamMemberLimit(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('maxOpenOrders') maxOpenOrders: unknown,
  ): Promise<TeamMemberDto> {
    // An unset GraphQL argument arrives as `undefined`: no limit.
    return withTeamErrors(() => this.actions.setLimit(ctx, id, { maxOpenOrders: maxOpenOrders ?? null }));
  }

  /** Starts or stops a member receiving new orders (team.members.edit). */
  @Mutation()
  @requirePermission('team.members.edit')
  setTeamMemberReceiving(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('receivingOrders') receivingOrders: unknown,
  ): Promise<TeamMemberDto> {
    return withTeamErrors(() => this.actions.setReceiving(ctx, id, { receivingOrders }));
  }

  /** Deactivates an active member and keeps its access as a snapshot (team.members.edit). */
  @Mutation()
  @requirePermission('team.members.edit')
  deactivateTeamMember(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<TeamMemberDto> {
    return withTeamErrors(() => this.actions.deactivate(ctx, id));
  }

  /** Gives an inactive member its snapshot access back (team.members.edit). */
  @Mutation()
  @requirePermission('team.members.edit')
  reactivateTeamMember(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<TeamMemberDto> {
    return withTeamErrors(() => this.actions.reactivate(ctx, id));
  }

  /** Removes a member and its account, or revokes an invited member's invitation (team.members.remove); the owner is refused. */
  @Mutation()
  @requirePermission('team.members.remove')
  removeTeamMember(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
    return withTeamErrors(async () => {
      await this.actions.remove(ctx, id);
      return true;
    });
  }
}
