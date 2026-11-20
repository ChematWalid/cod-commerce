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
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import type { StoreProductCollectionsView } from '../application/product-collections.service';
import type { SlugAvailabilityView } from '../application/slug-availability.service';
import { CollectionsActions } from './collections-actions';
import type { StoreCollectionDto, StoreCollectionListDto, StoreCollectionProductListDto } from './dto';
import { COLLECTIONS_REST_FILTERS, restCall } from './error-mapping';
import { MembershipActions } from './membership-actions';
import { COLLECTION_PERMISSIONS } from './permissions';

/** What a deletion answers. */
interface SuccessResult {
  readonly success: boolean;
}

/**
 * The active store's collections for clients that do not speak GraphQL (ADR 0017, D2315). Literal routes go before
 * `:id`, which would otherwise take them.
 */
@Controller('catalog/collections')
@UseFilters(...COLLECTIONS_REST_FILTERS)
export class CollectionsController {
  constructor(
    private readonly actions: CollectionsActions,
    private readonly membership: MembershipActions,
  ) {}

  /** A page of the store's collections (catalog.collections.view); `skip`, `take` and `search` in the query string. */
  @Get()
  @requirePermission(COLLECTION_PERMISSIONS.view)
  list(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<StoreCollectionListDto> {
    return restCall(() => this.actions.list(ctx, query));
  }

  /** Whether `slug` is free in the store (catalog.collections.view); `collectionId` is the one being edited. */
  @Get('slug-availability')
  @requirePermission(COLLECTION_PERMISSIONS.view)
  slugAvailability(@Ctx() ctx: RequestContext, @Query() query: unknown): Promise<SlugAvailabilityView> {
    return restCall(() => this.membership.slugAvailability(ctx, query));
  }

  /** The manual and automatic collections of a product of the store (catalog.collections.view); 404 otherwise. */
  @Get('of-product/:productId')
  @requirePermission(COLLECTION_PERMISSIONS.view)
  productCollections(
    @Ctx() ctx: RequestContext,
    @Param('productId') productId: string,
  ): Promise<StoreProductCollectionsView> {
    return restCall(() => this.membership.productCollections(ctx, productId));
  }

  /** Replaces a product's manual collections, `{ collectionIds }` (catalog.collections.edit). */
  @Put('of-product/:productId')
  @requirePermission(COLLECTION_PERMISSIONS.edit)
  setProductCollections(
    @Ctx() ctx: RequestContext,
    @Param('productId') productId: string,
    @Body() body: unknown,
  ): Promise<StoreProductCollectionsView> {
    return restCall(() => this.membership.setProductCollections(ctx, productId, body));
  }

  /** One collection of the store (catalog.collections.view); 404 for any other id. */
  @Get(':id')
  @requirePermission(COLLECTION_PERMISSIONS.view)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<StoreCollectionDto> {
    return restCall(() => this.actions.get(ctx, id));
  }

  /** A page of a collection's products (catalog.collections.view); `skip` and `take` in the query string. */
  @Get(':id/products')
  @requirePermission(COLLECTION_PERMISSIONS.view)
  products(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Query() query: unknown,
  ): Promise<StoreCollectionProductListDto> {
    return restCall(() => this.membership.products(ctx, id, query));
  }

  /** Replaces the hand-ordered products of a manual collection, `{ productIds }` (catalog.collections.edit). */
  @Put(':id/products')
  @requirePermission(COLLECTION_PERMISSIONS.edit)
  setProducts(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<StoreCollectionDto> {
    return restCall(() => this.membership.setProducts(ctx, id, body));
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
