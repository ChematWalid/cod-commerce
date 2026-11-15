import { requirePermission } from '@cod/plugin-rbac/guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CollectionsActions } from './collections-actions';
import type { StoreCollectionDto, StoreCollectionListDto } from './dto';
import { COLLECTIONS_REST_FILTERS, restCall } from './error-mapping';
import { COLLECTION_PERMISSIONS } from './permissions';

/** What a deletion answers. */
interface SuccessResult {
  readonly success: boolean;
}

/**
 * The active store's collections for clients that do not speak GraphQL (ADR 0017, D2315). Literal routes of later
 * tasks go before `:id`, which would otherwise take them.
 */
@Controller('catalog/collections')
@UseFilters(...COLLECTIONS_REST_FILTERS)
export class CollectionsController {
  constructor(private readonly actions: CollectionsActions) {}

  /** A page of the store's collections (catalog.collections.view); `skip`, `take` and `search` in the query string. */
  @Get()
  @requirePermission(COLLECTION_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<StoreCollectionListDto> {
    return restCall(() => this.actions.list(ctx, query));
  }

  /** One collection of the store (catalog.collections.view); 404 for any other id. */
  @Get(':id')
  @requirePermission(COLLECTION_PERMISSIONS.view)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<StoreCollectionDto> {
    return restCall(() => this.actions.get(ctx, id));
  }

  /** Creates one in the store (catalog.collections.create); 201 with it. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @requirePermission(COLLECTION_PERMISSIONS.create)
  create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<StoreCollectionDto> {
    return restCall(() => this.actions.create(ctx, body));
  }

  /** Changes one of the store (catalog.collections.edit). */
  @Patch(':id')
  @requirePermission(COLLECTION_PERMISSIONS.edit)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<StoreCollectionDto> {
    return restCall(() => this.actions.update(ctx, id, body));
  }

  /** Deletes one of the store with its members (catalog.collections.delete). */
  @Delete(':id')
  @requirePermission(COLLECTION_PERMISSIONS.delete)
  async delete(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<SuccessResult> {
    await restCall(() => this.actions.delete(ctx, id));
    return { success: true };
  }
}
