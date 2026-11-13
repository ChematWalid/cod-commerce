import { requirePermission } from '@cod/plugin-rbac/guard';
import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { TeamRestErrorFilter } from './error-mapping';
import { MemberReadActions } from './member-read-actions';
import type { TeamMemberDetailsDto, TeamMemberPageDto } from './member-dto';

/** The members list and one member, for clients that do not speak GraphQL (ADR 0017); the same reads. */
@Controller('employees')
@UseFilters(TeamRestErrorFilter)
export class MembersReadController {
  constructor(private readonly reads: MemberReadActions) {}

  /** `?tab=all|active|pending|inactive&search=&page=` */
  @Get()
  @requirePermission('team.members.view')
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<TeamMemberPageDto> {
    return this.reads.list(ctx, query);
  }

  /** One member of the business within the caller's store reach (team.members.view); 404 `team.member-not-found`. */
  @Get(':id')
  @requirePermission('team.members.view')
  get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<TeamMemberDetailsDto> {
    return this.reads.get(ctx, id);
  }
}
