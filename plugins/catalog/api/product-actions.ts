import { tenantOf } from '@cod/plugin-tenancy';
import { PRODUCT_STATUSES, productInputSchema, productListQuerySchema, productPatchSchema } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { z } from 'zod';
import { asOperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import {
  type CatalogProductDto,
  type CatalogProductListDto,
  type CatalogProductSaveResultDto,
  type CatalogSlugAvailabilityDto,
  toProductDto,
  toProductListDto,
  toSaveResultDto,
} from './dto';
import { ProductReadUseCases, ProductWriteUseCases } from './product-use-cases';
import { idArgOf, parseInput } from './request-body';

const statusSchema = z.enum(PRODUCT_STATUSES);
const slugSchema = z.string().max(1000);

/** The caller's business and active store, as the tenant guard resolved them. */
function scopeOf(ctx: RequestContext): StoreScope {
  const { businessId, activeStoreId } = tenantOf(ctx);
  return { businessId, storeId: activeStoreId };
}

/**
 * One path per product action for both API surfaces (team pattern): parse the input, take the tenant from the
 * request (never from the path, ADR 0008), run the use case and shape the answer. Handlers only add their error
 * mapping.
 */
@Injectable()
export class ProductActions {
  constructor(
    private readonly writes: ProductWriteUseCases,
    private readonly reads: ProductReadUseCases,
  ) {}

  async list(ctx: RequestContext, query: unknown): Promise<CatalogProductListDto> {
    const parsed = parseInput(productListQuerySchema, query ?? {});
    return toProductListDto(await this.reads.listing.list(asOperationContext(ctx), scopeOf(ctx), parsed));
  }

  async get(ctx: RequestContext, id: unknown): Promise<CatalogProductDto | null> {
    const view = await this.reads.reading.byId(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
    return view === undefined ? null : toProductDto(view);
  }

  async create(ctx: RequestContext, input: unknown): Promise<CatalogProductSaveResultDto> {
    const command = parseInput(productInputSchema, input);
    return toSaveResultDto(await this.writes.creating.create(asOperationContext(ctx), scopeOf(ctx), command));
  }

  async update(ctx: RequestContext, id: unknown, input: unknown): Promise<CatalogProductSaveResultDto> {
    const patch = parseInput(productPatchSchema, input);
    return toSaveResultDto(
      await this.writes.updating.update(asOperationContext(ctx), scopeOf(ctx), idArgOf(id), patch),
    );
  }

  async setStatus(ctx: RequestContext, id: unknown, status: unknown): Promise<CatalogProductDto> {
    const parsed = parseInput(statusSchema, status);
    return toProductDto(await this.writes.statuses.set(asOperationContext(ctx), scopeOf(ctx), idArgOf(id), parsed));
  }

  async delete(ctx: RequestContext, id: unknown): Promise<void> {
    await this.writes.deleting.delete(asOperationContext(ctx), scopeOf(ctx), idArgOf(id));
  }

  async slugAvailability(ctx: RequestContext, slug: unknown, productId: unknown): Promise<CatalogSlugAvailabilityDto> {
    // A slug is checked in the active store channel; this also refuses a context without a resolved tenant.
    scopeOf(ctx);
    const parsed = parseInput(slugSchema, slug);
    const self = productId === undefined || productId === null || productId === '' ? null : idArgOf(productId);
    return this.reads.slugs.check(asOperationContext(ctx), parsed, self);
  }
}
