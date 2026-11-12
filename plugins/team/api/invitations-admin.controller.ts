import { RateLimitedFilter } from '@cod/plugin-rate-limit';
import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { TeamRestErrorFilter } from './error-mapping';
import { InvitationActions } from './invitation-actions';
import type { TeamMemberDto } from './member-dto';
import { fieldOf } from './request-body';

/** What a revoke answers. */
interface SuccessResult {
  readonly success: boolean;
}

/** Inviting, resending and revoking for clients that do not speak GraphQL (ADR 0017); the same actions. */
@Controller('employees')
@UseFilters(TeamRestErrorFilter, RateLimitedFilter)
export class InvitationsAdminController {
  constructor(private readonly actions: InvitationActions) {}

  @Post()
  @requirePermission('team.members.invite')
  invite(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<TeamMemberDto> {
    return this.actions.invite(ctx, body);
  }

  @Post('resend-invitation')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.members.invite')
  resend(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<TeamMemberDto> {
    return this.actions.resend(ctx, fieldOf(body, 'memberId'));
  }

  @Post(':id/revoke-invitation')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.members.invite')
  async revoke(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await this.actions.revoke(ctx, id);
    return { success: true };
  }
}
