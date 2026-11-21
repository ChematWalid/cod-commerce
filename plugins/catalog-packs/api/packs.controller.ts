import { requirePermission } from '@cod/plugin-rbac/guard';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { PackNotFoundError } from '../domain/errors';
import type { CatalogPackDto, CatalogPackPreviewDto } from './dto';
import { PACKS_REST_FILTERS, restCall } from './error-mapping';
import { PackActions } from './pack-actions';
import { PACK_PERMISSIONS } from './permissions';

/** The store's packs for clients that do not speak GraphQL (ADR 0017, D2206). */
@Controller('catalog/packs')
@UseFilters(...PACKS_REST_FILTERS)
export class PacksController {
  constructor(private readonly actions: PackActions) {}

  /** What a pack would cost and weigh, saving nothing (catalog.products.edit); 429 past the actor's budget. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @requirePermission(PACK_PERMISSIONS.edit)
  preview(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<CatalogPackPreviewDto> {
    return restCall(() => this.actions.preview(ctx, body));
  }

  /** The pack of a product of the active store (catalog.products.view); 404 `packs.not-found` otherwise. */
  @Get(':productId')
  @requirePermission(PACK_PERMISSIONS.view)
  get(@Ctx() ctx: RequestContext, @Param('productId') productId: string): Promise<CatalogPackDto> {
    return restCall(async () => {
      const pack = await this.actions.get(ctx, productId);
      if (pack === null) throw new PackNotFoundError();
      return pack;
    });
  }

  /** Saves the pack of a pack product of the active store (catalog.products.edit). */
  @Put(':productId')
  @requirePermission(PACK_PERMISSIONS.edit)
  save(
    @Ctx() ctx: RequestContext,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ): Promise<CatalogPackDto> {
    return restCall(() => this.actions.save(ctx, productId, body));
  }
}
