import type { SubdomainAvailability } from '@cod/shared';
import { toSnowflake, toStoreId } from '@cod/shared';
import { RateLimit } from '@cod/plugin-rate-limit';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, ChannelService, Ctx, EntityNotFoundError, Permission, type RequestContext } from '@vendure/core';
import { ArchiveStoreService } from '../application/archive-store.service';
import { ChangeSubdomainService } from '../application/change-subdomain.service';
import { CheckSubdomainService } from '../application/check-subdomain.service';
import { CreateStoreService } from '../application/create-store.service';
import { GetStoresService } from '../application/get-stores.service';
import { UpdateStoreService } from '../application/update-store.service';
import { asOperationContext } from '../domain/ports/operation-context';
import type { Store } from '../domain/store';
import { type CreateStoreInputDto, toCreateStoreCommand, toStorePatch, type UpdateStoreInputDto } from './dto';
import { withApiErrors } from './error-mapping';
import { tenantStorePermission } from './permissions';
import { storeActorOf } from './store-actor';
import { tenantOf } from './tenant-of';
import { TenantScoped } from './tenant-scoped.decorator';

/** Reads the stores of the caller's business, and subdomain availability. */
@Resolver()
export class StoreQueryResolver {
  constructor(
    private readonly getStores: GetStoresService,
    private readonly checkSubdomain: CheckSubdomainService,
  ) {}

  /** Every store the caller can read, archived ones included. */
  @Query()
  @Allow(tenantStorePermission.Read)
  @TenantScoped()
  stores(@Ctx() ctx: RequestContext): Promise<readonly Store[]> {
    return withApiErrors(() =>
      this.getStores.list(asOperationContext(ctx), storeActorOf(ctx, tenantStorePermission.Read)),
    );
  }

  /** One store, or `null` when the caller cannot read it. */
  @Query()
  @Allow(tenantStorePermission.Read)
  @TenantScoped()
  store(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<Store | undefined> {
    return withApiErrors(() =>
      this.getStores.get(asOperationContext(ctx), storeActorOf(ctx, tenantStorePermission.Read), toStoreId(id)),
    );
  }

  /** Whether a store could use `subdomain`. Public: the sign-up wizard asks before an account exists. */
  @Query()
  @Allow(Permission.Public)
  @RateLimit('subdomain-ip')
  subdomainAvailability(
    @Ctx() ctx: RequestContext,
    @Args('subdomain') subdomain: string,
  ): Promise<SubdomainAvailability> {
    return withApiErrors(() => this.checkSubdomain.check(asOperationContext(ctx), subdomain));
  }
}

/** Changes the stores of the caller's business. */
@Resolver()
export class StoreMutationResolver {
  constructor(
    private readonly createStores: CreateStoreService,
    private readonly updateStores: UpdateStoreService,
    private readonly archiveStores: ArchiveStoreService,
    private readonly changeSubdomain: ChangeSubdomainService,
  ) {}

  /** Opens a store for the caller's business. */
  @Mutation()
  @Allow(tenantStorePermission.Create)
  @TenantScoped()
  createStore(@Ctx() ctx: RequestContext, @Args('input') input: CreateStoreInputDto): Promise<Store> {
    return withApiErrors(() =>
      this.createStores.create(
        asOperationContext(ctx),
        toSnowflake(tenantOf(ctx).businessId),
        toCreateStoreCommand(input),
      ),
    );
  }

  /** Changes a store's settings. */
  @Mutation()
  @Allow(tenantStorePermission.Update)
  @TenantScoped()
  updateStore(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('input') input: UpdateStoreInputDto,
  ): Promise<Store> {
    return withApiErrors(() =>
      this.updateStores.update(
        asOperationContext(ctx),
        storeActorOf(ctx, tenantStorePermission.Update),
        toStoreId(id),
        toStorePatch(input),
      ),
    );
  }

  /** Soft-deletes a store. */
  @Mutation()
  @Allow(tenantStorePermission.Delete)
  @TenantScoped()
  archiveStore(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<Store> {
    return withApiErrors(() =>
      this.archiveStores.archive(
        asOperationContext(ctx),
        storeActorOf(ctx, tenantStorePermission.Delete),
        toStoreId(id),
      ),
    );
  }

  /** Moves a store to another subdomain (D11). */
  @Mutation()
  @Allow(tenantStorePermission.Update)
  @TenantScoped()
  changeStoreSubdomain(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('subdomain') subdomain: string,
  ): Promise<Store> {
    return withApiErrors(() =>
      this.changeSubdomain.change(
        asOperationContext(ctx),
        storeActorOf(ctx, tenantStorePermission.Update),
        toStoreId(id),
        subdomain,
      ),
    );
  }
}

/** The `Store` fields the domain object does not carry. */
@Resolver('Store')
export class StoreFieldsResolver {
  constructor(private readonly channels: ChannelService) {}

  /** The token that selects this store's channel; only reachable through a store the caller could read. */
  @ResolveField()
  async channelToken(@Ctx() ctx: RequestContext, @Parent() store: Store): Promise<string> {
    const channel = await this.channels.findOne(ctx, store.channelId);
    if (channel === undefined) throw new EntityNotFoundError('Channel', store.channelId);
    return channel.token;
  }
}
