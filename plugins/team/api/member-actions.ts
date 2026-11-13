import { payMemberSchema, setLimitSchema, setReceivingSchema, updateMemberSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { ListOrderManagersService } from '../application/list-order-managers.service';
import { MemberLifecycleService } from '../application/member-lifecycle.service';
import { PaySalaryService } from '../application/pay-salary.service';
import { RemoveMemberService } from '../application/remove-member.service';
import { UpdateMemberService } from '../application/update-member.service';
import type { OrderManagerView } from '../domain/order-manager';
import { asOperationContext } from '../domain/ports/operation-context';
import { TeamRequestActors } from './actor-of';
import { type SalaryPaymentDto, type TeamMemberDto, toSalaryPaymentDto, toTeamMemberDto } from './member-dto';
import { memberIdOf, parseInput } from './request-body';

/** The member action use cases an administrator calls (brief step 4). */
@Injectable()
export class MemberActionUseCases {
  constructor(
    readonly updater: UpdateMemberService,
    readonly lifecycle: MemberLifecycleService,
    readonly remover: RemoveMemberService,
    readonly payer: PaySalaryService,
  ) {}
}

/**
 * One path per member action for both API surfaces: parse the input, identify the caller and what it may see (D207),
 * run the use case and shape the answer. The GraphQL and REST handlers only add their error mapping.
 */
@Injectable()
export class MemberActions {
  constructor(
    private readonly useCases: MemberActionUseCases,
    private readonly orderManagers: ListOrderManagersService,
    private readonly actors: TeamRequestActors,
  ) {}

  async update(ctx: RequestContext, memberId: unknown, input: unknown): Promise<TeamMemberDto> {
    const id = memberIdOf(memberId);
    const edit = parseInput(updateMemberSchema, input);
    const actor = await this.actors.actorOf(ctx);
    const view = this.actors.viewOptionsOf(ctx);
    return toTeamMemberDto(await this.useCases.updater.update(asOperationContext(ctx), actor, { id, edit }, view));
  }

  async setLimit(ctx: RequestContext, memberId: unknown, input: unknown): Promise<TeamMemberDto> {
    const id = memberIdOf(memberId);
    const { maxOpenOrders } = parseInput(setLimitSchema, input);
    const actor = await this.actors.actorOf(ctx);
    const command = { id, maxOpenOrders };
    const view = this.actors.viewOptionsOf(ctx);
    return toTeamMemberDto(await this.useCases.lifecycle.setLimit(asOperationContext(ctx), actor, command, view));
  }

  async setReceiving(ctx: RequestContext, memberId: unknown, input: unknown): Promise<TeamMemberDto> {
    const id = memberIdOf(memberId);
    const { receivingOrders } = parseInput(setReceivingSchema, input);
    const actor = await this.actors.actorOf(ctx);
    const command = { id, receivingOrders };
    const view = this.actors.viewOptionsOf(ctx);
    return toTeamMemberDto(await this.useCases.lifecycle.setReceiving(asOperationContext(ctx), actor, command, view));
  }

  async deactivate(ctx: RequestContext, memberId: unknown): Promise<TeamMemberDto> {
    const id = memberIdOf(memberId);
    const actor = await this.actors.actorOf(ctx);
    const view = this.actors.viewOptionsOf(ctx);
    return toTeamMemberDto(await this.useCases.lifecycle.deactivate(asOperationContext(ctx), actor, id, view));
  }

  async reactivate(ctx: RequestContext, memberId: unknown): Promise<TeamMemberDto> {
    const id = memberIdOf(memberId);
    const actor = await this.actors.actorOf(ctx);
    const view = this.actors.viewOptionsOf(ctx);
    return toTeamMemberDto(await this.useCases.lifecycle.reactivate(asOperationContext(ctx), actor, id, view));
  }

  async remove(ctx: RequestContext, memberId: unknown): Promise<void> {
    const id = memberIdOf(memberId);
    await this.useCases.remover.remove(asOperationContext(ctx), await this.actors.actorOf(ctx), id);
  }

  async pay(ctx: RequestContext, memberId: unknown, input: unknown): Promise<SalaryPaymentDto> {
    const id = memberIdOf(memberId);
    const { idempotencyKey } = parseInput(payMemberSchema, input);
    const actor = await this.actors.actorOf(ctx);
    return toSalaryPaymentDto(await this.useCases.payer.pay(asOperationContext(ctx), actor, id, idempotencyKey));
  }

  async listOrderManagers(ctx: RequestContext): Promise<OrderManagerView[]> {
    return this.orderManagers.list(asOperationContext(ctx), await this.actors.actorOf(ctx));
  }
}
