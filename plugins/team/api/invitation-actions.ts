import { inviteMemberSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { InviteMemberService } from '../application/invite-member.service';
import { ResendInvitationService } from '../application/resend-invitation.service';
import { RevokeInvitationService } from '../application/revoke-invitation.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { type TeamMemberDto, toTeamMemberDto } from './member-dto';
import { TeamRequestActors } from './actor-of';
import { memberIdOf, parseInput } from './request-body';
import { TeamThrottle } from './team-throttle';

/** The three invitation use cases an administrator calls. */
@Injectable()
export class InvitationUseCases {
  constructor(
    readonly inviter: InviteMemberService,
    readonly resender: ResendInvitationService,
    readonly revoker: RevokeInvitationService,
  ) {}
}

/**
 * One path per invitation action for both API surfaces: parse the input, identify the caller, spend its mail
 * budget (D205), run the use case and shape the answer. The GraphQL and REST handlers only add their error mapping.
 */
@Injectable()
export class InvitationActions {
  constructor(
    private readonly useCases: InvitationUseCases,
    private readonly actors: TeamRequestActors,
    private readonly throttle: TeamThrottle,
  ) {}

  async invite(ctx: RequestContext, input: unknown): Promise<TeamMemberDto> {
    const command = parseInput(inviteMemberSchema, input);
    const actor = await this.actors.actorOf(ctx);
    await this.throttle.spendInvite(actor);
    const view = this.actors.viewOptionsOf(ctx);
    return toTeamMemberDto(await this.useCases.inviter.invite(asOperationContext(ctx), actor, command, view));
  }

  async resend(ctx: RequestContext, memberId: unknown): Promise<TeamMemberDto> {
    const id = memberIdOf(memberId);
    const actor = await this.actors.actorOf(ctx);
    await this.throttle.spendResend(actor);
    const view = this.actors.viewOptionsOf(ctx);
    return toTeamMemberDto(await this.useCases.resender.resend(asOperationContext(ctx), actor, id, view));
  }

  async revoke(ctx: RequestContext, memberId: unknown): Promise<void> {
    const id = memberIdOf(memberId);
    await this.useCases.revoker.revoke(asOperationContext(ctx), await this.actors.actorOf(ctx), id);
  }
}
