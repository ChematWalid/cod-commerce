import type { DeliveryFeeGroup, DeliveryFeeGroupPage } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { asOperationContext } from '../domain/ports/operation-context';
import { toGroupDto, toPageDto } from './dto';
import { FeeGroupUseCases } from './fee-group-use-cases';
import { idArgOf, parseCommuneRatesInput, parseFeeGroupInput, parseListQuery } from './request-body';
import { scopeOf } from './store-scope-of';

/**
 * One path per fee-group action for both API surfaces (D2102): parse the input, take the tenant and store from the
 * session and `vendure-token` (never from the path), run the use case and shape the answer.
 */
@Injectable()
export class FeeGroupActions {
  constructor(private readonly useCases: FeeGroupUseCases) {}

  /** A page of the active store's groups. */
  async list(ctx: RequestContext, options: unknown): Promise<DeliveryFeeGroupPage> {
    const query = parseListQuery(options);
    return toPageDto(await this.useCases.reading.list(asOperationContext(ctx), scopeOf(ctx), query));
  }

  /** The store's group, or `null` for an unknown, foreign, other-store or malformed id. */
  async get(ctx: RequestContext, id: unknown): Promise<DeliveryFeeGroup | null> {
    const group = await this.useCases.reading.get(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
    return group === undefined ? null : toGroupDto(group);
  }

  /** Parses and creates a group in the active store. */
  async create(ctx: RequestContext, input: unknown): Promise<DeliveryFeeGroup> {
    const scope = scopeOf(ctx);
    const parsed = parseFeeGroupInput(input);
    return toGroupDto(await this.useCases.saving.create(asOperationContext(ctx), scope, parsed));
  }

  /** Parses and replaces the store's group `id`. */
  async update(ctx: RequestContext, id: unknown, input: unknown): Promise<DeliveryFeeGroup> {
    const scope = scopeOf(ctx);
    const parsed = parseFeeGroupInput(input);
    return toGroupDto(await this.useCases.saving.update(asOperationContext(ctx), scope, idArgOf(id), parsed));
  }

  /** Deletes the store's group `id`. */
  async delete(ctx: RequestContext, id: unknown): Promise<void> {
    await this.useCases.deleting.delete(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
  }

  /** Merges the communes of one wilaya into the store's group `id` (D3125). */
  async setCommuneRates(
    ctx: RequestContext,
    id: unknown,
    provinceCode: unknown,
    rows: unknown,
  ): Promise<DeliveryFeeGroup> {
    const scope = scopeOf(ctx);
    const parsed = parseCommuneRatesInput(provinceCode, rows);
    const group = await this.useCases.communes.set(asOperationContext(ctx), scope, idArgOf(id), parsed);
    return toGroupDto(group);
  }
}
