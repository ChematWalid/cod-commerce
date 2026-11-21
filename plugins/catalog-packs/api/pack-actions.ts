import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { asOperationContext } from '../domain/ports/operation-context';
import { type CatalogPackDto, type CatalogPackPreviewDto, toPackDto, toPreviewDto } from './dto';
import { PackThrottle } from './pack-throttle';
import { PackUseCases } from './pack-use-cases';
import { definitionOf, idArgOf, parsePackInput } from './request-body';
import { scopeOf } from './store-scope-of';

/**
 * One path per pack action for both API surfaces: parse the input, take the tenant from the request (never from the
 * path or channel, D2236), run the use case and shape the answer. Handlers only add their error mapping.
 */
@Injectable()
export class PackActions {
  constructor(
    private readonly useCases: PackUseCases,
    private readonly throttle: PackThrottle,
  ) {}

  /** The pack of product `productId` in the caller's store, or `null` (none, not a pack, foreign, malformed). */
  async get(ctx: RequestContext, productId: unknown): Promise<CatalogPackDto | null> {
    const view = await this.useCases.getting.get(asOperationContext(ctx), scopeOf(ctx), idArgOf(productId));
    return view === undefined ? null : toPackDto(view);
  }

  /** Parses the input and saves the pack of product `productId`; refusals are thrown as domain errors. */
  async save(ctx: RequestContext, productId: unknown, input: unknown): Promise<CatalogPackDto> {
    const scope = scopeOf(ctx);
    const definition = definitionOf(parsePackInput(input));
    const request = { productId: idArgOf(productId), definition };
    return toPackDto(await this.useCases.saving.save(asOperationContext(ctx), scope, request));
  }

  /**
   * Computes a pack without saving it. The caller's preview budget is spent before the input is parsed, so a malformed
   * input counts against it too (D2217).
   */
  async preview(ctx: RequestContext, input: unknown): Promise<CatalogPackPreviewDto> {
    const scope = scopeOf(ctx);
    await this.throttle.spendPreview(scope.businessId, String(ctx.activeUserId));
    const definition = definitionOf(parsePackInput(input));
    return toPreviewDto(await this.useCases.previewing.preview(asOperationContext(ctx), scope, definition));
  }
}
