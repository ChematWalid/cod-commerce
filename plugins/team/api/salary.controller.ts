import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { TeamRestErrorFilter } from './error-mapping';
import { MemberActions } from './member-actions';
import type { SalaryPaymentDto } from './member-dto';

/** "Pay salary" for clients that do not speak GraphQL (ADR 0017); the same action. */
@Controller('employees')
@UseFilters(TeamRestErrorFilter)
export class SalaryController {
  constructor(private readonly actions: MemberActions) {}

  /** Body `{ idempotencyKey }`: a repeat with the same key answers the first payment (D212). */
  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.members.edit')
  pay(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<SalaryPaymentDto> {
    return this.actions.pay(ctx, id, body);
  }
}
