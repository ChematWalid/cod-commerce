import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CommissionActions } from './commission-actions';
import type { CommissionBasisOptionDto, CommissionConfigDto } from './commission-dto';
import { TeamRestErrorFilter } from './error-mapping';

/** What a deletion answers. */
interface SuccessResult {
  readonly success: boolean;
}

/** The commission structures of a business for clients that do not speak GraphQL (ADR 0017); store only (P7.S1). */
@Controller('commissions/configs')
@UseFilters(TeamRestErrorFilter)
export class CommissionsController {
  constructor(private readonly actions: CommissionActions) {}

  /** Declared before `:id`, which would otherwise take `actions` for a config id. */
  @Get('actions')
  @requirePermission('team.commissions.view')
  bases(): CommissionBasisOptionDto[] {
    return this.actions.bases();
  }

  /** The business's commission structures (team.commissions.view). */
  @Get()
  @requirePermission('team.commissions.view')
  list(@Ctx() ctx: RequestContext): Promise<CommissionConfigDto[]> {
    return this.actions.list(ctx);
  }

  /** Creates a commission structure (team.commissions.set); 409 `team.commission-name-taken`. */
  @Post()
  @requirePermission('team.commissions.set')
  create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CommissionConfigDto> {
    return this.actions.create(ctx, body);
  }

  /** One commission structure (team.commissions.view); 404 `team.commission-not-found`. */
  @Get(':id')
  @requirePermission('team.commissions.view')
  get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<CommissionConfigDto> {
    return this.actions.get(ctx, id);
  }

  /** Edits a commission structure (team.commissions.edit); 409 `team.commission-name-taken`. */
  @Patch(':id')
  @requirePermission('team.commissions.edit')
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<CommissionConfigDto> {
    return this.actions.update(ctx, id, body);
  }

  /** Deletes a commission structure (team.commissions.delete); 409 `team.commission-in-use` while a member has it. */
  @Delete(':id')
  @requirePermission('team.commissions.delete')
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await this.actions.delete(ctx, id);
    return { success: true };
  }
}
