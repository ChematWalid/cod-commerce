import { requirePermission } from '@cod/plugin-rbac/guard';
import { Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import type { OrderManagerView } from '../domain/order-manager';
import { withTeamErrors } from './error-mapping';
import { MemberActions } from './member-actions';

/** The members orders can be handed to (D209), on the Admin API; the same read as the REST route. */
@Resolver()
export class OrderManagersResolver {
  constructor(private readonly actions: MemberActions) {}

  @Query()
  @requirePermission('team.members.view')
  teamOrderManagers(@Ctx() ctx: RequestContext): Promise<OrderManagerView[]> {
    return withTeamErrors(() => this.actions.listOrderManagers(ctx));
  }
}
