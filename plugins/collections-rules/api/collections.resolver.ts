import { requirePermission } from '@cod/plugin-rbac/guard';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { CollectionsActions } from './collections-actions';
import type { StoreCollectionDto, StoreCollectionListDto } from './dto';
import { withCollectionsErrors } from './error-mapping';
import { COLLECTION_PERMISSIONS } from './permissions';

const { view, create, edit } = COLLECTION_PERMISSIONS;

/** The active store's collections on the Admin API; the same actions as the REST routes (D2314). */
@Resolver()
export class CollectionsResolver {
  constructor(private readonly actions: CollectionsActions) {}

  /** A page of the store's collections by position (D2318), optionally searched by title (D2325). */
  @Query()
  @requirePermission(view)
  storeCollections(@Ctx() ctx: RequestContext, @Args('options') options: unknown): Promise<StoreCollectionListDto> {
    return withCollectionsErrors(() => this.actions.list(ctx, options));
  }

  /** One collection of the store; `null` for a foreign, other-store or malformed id. */
  @Query()
  @requirePermission(view)
  storeCollection(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<StoreCollectionDto | null> {
    return withCollectionsErrors(() => this.actions.find(ctx, id));
  }

  /** Creates a collection in the store channel only (D2333). */
  @Mutation()
  @requirePermission(create)
  createStoreCollection(@Ctx() ctx: RequestContext, @Args('input') input: unknown): Promise<StoreCollectionDto> {
    return withCollectionsErrors(() => this.actions.create(ctx, input));
  }

  /** Changes a collection of the store; an absent field stays as it is. */
  @Mutation()
  @requirePermission(edit)
  updateStoreCollection(
    @Ctx() ctx: RequestContext,
    @Args('id') id: unknown,
    @Args('input') input: unknown,
  ): Promise<StoreCollectionDto> {
    return withCollectionsErrors(() => this.actions.update(ctx, id, input));
  }

  /** Deletes a collection of the store with its members (sensitive key). */
  @Mutation()
  @requirePermission(COLLECTION_PERMISSIONS.delete)
  async deleteStoreCollection(@Ctx() ctx: RequestContext, @Args('id') id: unknown): Promise<boolean> {
    await withCollectionsErrors(() => this.actions.delete(ctx, id));
    return true;
  }
}
