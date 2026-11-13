import { commissionConfigSchema, updateCommissionConfigSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { CommissionConfigService } from '../application/commission-config.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { TeamRequestActors } from './actor-of';
import {
  type CommissionBasisOptionDto,
  type CommissionConfigDto,
  toCommissionBasisOptionDto,
  toCommissionConfigDto,
} from './commission-dto';
import { commissionIdOf, parseInput } from './request-body';

/**
 * One path per commission action for both API surfaces: parse the input, identify the caller, run the use case and
 * shape the answer. The GraphQL and REST handlers only add their error mapping.
 */
@Injectable()
export class CommissionActions {
  constructor(
    private readonly commissions: CommissionConfigService,
    private readonly actors: TeamRequestActors,
  ) {}

  async list(ctx: RequestContext): Promise<CommissionConfigDto[]> {
    const configs = await this.commissions.list(asOperationContext(ctx), await this.actors.actorOf(ctx));
    return configs.map(toCommissionConfigDto);
  }

  async get(ctx: RequestContext, configId: unknown): Promise<CommissionConfigDto> {
    const id = commissionIdOf(configId);
    const actor = await this.actors.actorOf(ctx);
    return toCommissionConfigDto(await this.commissions.get(asOperationContext(ctx), actor, id));
  }

  bases(): CommissionBasisOptionDto[] {
    return this.commissions.bases().map(toCommissionBasisOptionDto);
  }

  async create(ctx: RequestContext, input: unknown): Promise<CommissionConfigDto> {
    const command = parseInput(commissionConfigSchema, input);
    const actor = await this.actors.actorOf(ctx);
    return toCommissionConfigDto(await this.commissions.create(asOperationContext(ctx), actor, command));
  }

  async update(ctx: RequestContext, configId: unknown, input: unknown): Promise<CommissionConfigDto> {
    const id = commissionIdOf(configId);
    const patch = parseInput(updateCommissionConfigSchema, input);
    const actor = await this.actors.actorOf(ctx);
    return toCommissionConfigDto(await this.commissions.update(asOperationContext(ctx), actor, id, patch));
  }

  async delete(ctx: RequestContext, configId: unknown): Promise<void> {
    const id = commissionIdOf(configId);
    await this.commissions.delete(asOperationContext(ctx), await this.actors.actorOf(ctx), id);
  }
}
