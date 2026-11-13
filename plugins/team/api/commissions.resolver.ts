import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { CommissionActions } from './commission-actions';
import type { CommissionBasisOptionDto, CommissionConfigDto } from './commission-dto';
import { withTeamErrors } from './error-mapping';

/** The commission structures of a business on the Admin API; the same actions as the REST routes. */
@Resolver()
export class CommissionsResolver {
  constructor(private readonly actions: CommissionActions) {}

  /** The business's commission structures (team.commissions.view). */
  @Query()
  @requirePermission('team.commissions.view')
  teamCommissionConfigs(@Ctx() ctx: RequestContext): Promise<CommissionConfigDto[]> {
    return withTeamErrors(() => this.actions.list(ctx));
  }

  /** One commission structure (team.commissions.view); `team.commission-not-found` otherwise. */
  @Query()
  @requirePermission('team.commissions.view')
  teamCommissionConfig(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<CommissionConfigDto> {
    return withTeamErrors(() => this.actions.get(ctx, id));
  }

  /** What a commission can be earned on, for the config form (team.commissions.view). */
  @Query()
  @requirePermission('team.commissions.view')
  teamCommissionBases(): CommissionBasisOptionDto[] {
    return this.actions.bases();
  }

  /** Creates a commission structure (team.commissions.set); refuses a name already taken. */
  @Mutation()
  @requirePermission('team.commissions.set')
  createTeamCommissionConfig(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<CommissionConfigDto> {
    return withTeamErrors(() => this.actions.create(ctx, input));
  }

  /** Edits a commission structure (team.commissions.edit); refuses a name already taken. */
  @Mutation()
  @requirePermission('team.commissions.edit')
  updateTeamCommissionConfig(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('input') input: unknown,
  ): Promise<CommissionConfigDto> {
    return withTeamErrors(() => this.actions.update(ctx, id, input));
  }

  /** Deletes a commission structure (team.commissions.delete); refuses one a member still has. */
  @Mutation()
  @requirePermission('team.commissions.delete')
  async deleteTeamCommissionConfig(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<boolean> {
    await withTeamErrors(() => this.actions.delete(ctx, id));
    return true;
  }
}
