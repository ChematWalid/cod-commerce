import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { TeamRestErrorFilter } from './error-mapping';
import { MemberActions } from './member-actions';
import type { TeamMemberDto } from './member-dto';

/** What a removal answers. */
interface SuccessResult {
  readonly success: boolean;
}

/** Editing, limiting, pausing, deactivating and removing members for clients that do not speak GraphQL (ADR 0017). */
@Controller('employees')
@UseFilters(TeamRestErrorFilter)
export class MemberActionsController {
  constructor(private readonly actions: MemberActions) {}

  /** Edits a member's roles, stores, salary or commissions (team.members.edit); 403 `team.self-action` on one's own pay (D212). */
  @Patch(':id')
  @requirePermission('team.members.edit')
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<TeamMemberDto> {
    return this.actions.update(ctx, id, body);
  }

  /** Body `{ maxOpenOrders: number | null }`. */
  @Post(':id/limit')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.members.edit')
  setLimit(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<TeamMemberDto> {
    return this.actions.setLimit(ctx, id, body);
  }

  /** Body `{ receivingOrders: boolean }`. */
  @Post(':id/receiving')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.members.edit')
  setReceiving(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<TeamMemberDto> {
    return this.actions.setReceiving(ctx, id, body);
  }

  /** Deactivates an active member and keeps its access as a snapshot (team.members.edit); 409 `team.member-not-active`. */
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.members.edit')
  deactivate(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<TeamMemberDto> {
    return this.actions.deactivate(ctx, id);
  }

  /** Gives an inactive member its snapshot access back (team.members.edit); 409 `team.access-unavailable` if it is gone. */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.members.edit')
  reactivate(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<TeamMemberDto> {
    return this.actions.reactivate(ctx, id);
  }

  /** Removes a member and its account, or revokes an invited member's invitation (team.members.remove); 403 `team.owner-protected`. */
  @Delete(':id')
  @requirePermission('team.members.remove')
  async remove(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await this.actions.remove(ctx, id);
    return { success: true };
  }
}
