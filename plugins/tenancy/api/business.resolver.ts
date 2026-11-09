import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import { GetBusinessService } from '../application/get-business.service';
import { type ProvisionedBusiness, ProvisionBusinessService } from '../application/provision-business.service';
import { UpdateBusinessService } from '../application/update-business.service';
import type { Business } from '../domain/business';
import { asOperationContext } from '../domain/ports/operation-context';
import {
  type ProvisionBusinessInputDto,
  toBusinessPatch,
  toCreateStoreCommand,
  type UpdateBusinessInputDto,
} from './dto';
import { withApiErrors } from './error-mapping';
import { tenantBusinessPermission } from './permissions';
import { tenantOf } from './tenant-of';
import { TenantScoped } from './tenant-scoped.decorator';

/** The caller's business, and the platform's way of starting one. */
@Resolver()
export class BusinessResolver {
  constructor(
    private readonly getBusiness: GetBusinessService,
    private readonly updateBusinessService: UpdateBusinessService,
    private readonly provisioning: ProvisionBusinessService,
  ) {}

  /** The business of the request's tenant. */
  @Query()
  @Allow(tenantBusinessPermission.Read)
  @TenantScoped()
  activeBusiness(@Ctx() ctx: RequestContext): Promise<Business> {
    return withApiErrors(() => this.getBusiness.get(asOperationContext(ctx), tenantOf(ctx).businessId));
  }

  /** The caller's business when `id` is its id, otherwise `null`. */
  @Query()
  @Allow(tenantBusinessPermission.Read)
  @TenantScoped()
  async business(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<Business | null> {
    const { businessId } = tenantOf(ctx);
    if (id !== businessId) return null;
    return withApiErrors(() => this.getBusiness.get(asOperationContext(ctx), businessId));
  }

  /** Changes the caller's business. */
  @Mutation()
  @Allow(tenantBusinessPermission.Update)
  @TenantScoped()
  updateBusiness(@Ctx() ctx: RequestContext, @Args('input') input: UpdateBusinessInputDto): Promise<Business> {
    return withApiErrors(() =>
      this.updateBusinessService.update(asOperationContext(ctx), tenantOf(ctx).businessId, toBusinessPatch(input)),
    );
  }

  /** Starts a business with its first store and owner (D5). */
  @Mutation()
  @Allow(Permission.SuperAdmin)
  provisionBusiness(
    @Ctx() ctx: RequestContext,
    @Args('input') input: ProvisionBusinessInputDto,
  ): Promise<ProvisionedBusiness> {
    return withApiErrors(() =>
      this.provisioning.provision(asOperationContext(ctx), {
        name: input.name,
        owner: input.owner,
        store: toCreateStoreCommand(input.store),
      }),
    );
  }
}
