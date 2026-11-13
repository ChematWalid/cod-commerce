import { requirePermission } from '@cod/plugin-rbac/guard';
import { Controller, Get, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import type { OrderManagerView } from '../domain/order-manager';
import { TeamRestErrorFilter } from './error-mapping';
import { MemberActions } from './member-actions';

/**
 * The members orders can be handed to (D209). Registered before the members read controller, whose
 * `GET /employees/:id` would otherwise take `order-managers` for a member id.
 */
@Controller('employees')
@UseFilters(TeamRestErrorFilter)
export class OrderManagersController {
  constructor(private readonly actions: MemberActions) {}

  @Get('order-managers')
  @requirePermission('team.members.view')
  list(@Ctx() ctx: RequestContext): Promise<OrderManagerView[]> {
    return this.actions.listOrderManagers(ctx);
  }
}
