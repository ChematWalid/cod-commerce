import { listMembersQuerySchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { GetMemberService } from '../application/get-member.service';
import { ListMembersService } from '../application/list-members.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { TeamRequestActors } from './actor-of';
import {
  type TeamMemberDetailsDto,
  type TeamMemberPageDto,
  toTeamMemberDetailsDto,
  toTeamMemberPageDto,
} from './member-dto';
import { memberIdOf, parseInput } from './request-body';

/**
 * One path per member read for both API surfaces: parse the input, identify the caller and what it may see (D207),
 * run the use case and shape the answer. The GraphQL and REST handlers only add their error mapping.
 */
@Injectable()
export class MemberReadActions {
  constructor(
    private readonly lister: ListMembersService,
    private readonly getter: GetMemberService,
    private readonly actors: TeamRequestActors,
  ) {}

  async list(ctx: RequestContext, input: unknown): Promise<TeamMemberPageDto> {
    const query = parseInput(listMembersQuerySchema, input ?? {});
    const actor = await this.actors.actorOf(ctx);
    const page = await this.lister.list(asOperationContext(ctx), actor, query, this.actors.viewOptionsOf(ctx));
    return toTeamMemberPageDto(page);
  }

  async get(ctx: RequestContext, memberId: unknown): Promise<TeamMemberDetailsDto> {
    const id = memberIdOf(memberId);
    const actor = await this.actors.actorOf(ctx);
    const details = await this.getter.get(asOperationContext(ctx), actor, id, this.actors.viewOptionsOf(ctx));
    return toTeamMemberDetailsDto(details);
  }
}
