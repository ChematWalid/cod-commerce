import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { withTeamErrors } from './error-mapping';
import { MemberActions } from './member-actions';
import type { SalaryPaymentDto } from './member-dto';

/** "Pay salary" on the Admin API; the same action as the REST route. */
@Resolver()
export class SalaryResolver {
  constructor(private readonly actions: MemberActions) {}

  @Mutation()
  @requirePermission('team.members.edit')
  payTeamMember(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('idempotencyKey') idempotencyKey: unknown,
  ): Promise<SalaryPaymentDto> {
    return withTeamErrors(() => this.actions.pay(ctx, id, { idempotencyKey }));
  }
}
