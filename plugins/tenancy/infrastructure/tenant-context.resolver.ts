import { type BusinessId, type StoreId, type TenantContext, toBusinessId, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { AdministratorService, idsAreEqual, type RequestContext } from '@vendure/core';
import type { TenantContextResolverPort } from '../application/ports/tenant-context-resolver.port';
import { asOperationContext } from '../domain/ports/operation-context';
import type { StoreAccess } from '../domain/store';
import { PlatformStoreLookup } from './platform-store-lookup';

interface AdministratorTenantFields {
  readonly businessId?: string | null;
}

const NO_RELATIONS: never[] = [];

/** Active stores whose channel the user holds a role on; `ctx.session` is the auth guard's verified view. */
function accessibleStores(ctx: RequestContext, stores: readonly StoreAccess[]): readonly StoreAccess[] {
  const channels = ctx.session?.user?.channelPermissions ?? [];
  return stores.filter(
    (store) => store.status === 'active' && channels.some((channel) => idsAreEqual(channel.id, store.channelId)),
  );
}

function toTenant(
  ctx: RequestContext,
  businessId: BusinessId,
  stores: readonly StoreAccess[],
): TenantContext | undefined {
  const accessible = accessibleStores(ctx, stores);
  const active = accessible.find((store) => idsAreEqual(store.channelId, ctx.channelId));
  if (active === undefined) return undefined;
  const storeIds: readonly StoreId[] = accessible.map((store) => store.id);
  return { businessId, storeIds, activeStoreId: active.id };
}

/**
 * Derives the tenant from the authenticated administrator and the active channel (ADR 0002). Store and business
 * status come from our rows on each request, not Vendure's channel cache (ADR 0002 §7, D9).
 */
@Injectable()
export class TenantContextResolver implements TenantContextResolverPort<RequestContext> {
  constructor(
    private readonly administrators: AdministratorService,
    private readonly lookup: PlatformStoreLookup,
  ) {}

  /** The tenant of the request, or `undefined`: the default channel never belongs to a business. */
  async resolve(ctx: RequestContext): Promise<TenantContext | undefined> {
    const businessId = await this.businessOf(ctx);
    if (businessId === undefined) return undefined;
    const operation = asOperationContext(ctx);
    const business = await this.lookup.findBusiness(operation, toSnowflake(businessId));
    if (business?.status !== 'active') return undefined;
    return toTenant(ctx, businessId, await this.lookup.findStoreAccess(operation, businessId));
  }

  private async businessOf(ctx: RequestContext): Promise<BusinessId | undefined> {
    const userId = ctx.activeUserId;
    if (userId === undefined) return undefined;
    const administrator = await this.administrators.findOneByUserId(ctx, userId, NO_RELATIONS);
    const fields: AdministratorTenantFields | undefined = administrator?.customFields;
    const businessId = fields?.businessId;
    return businessId === undefined || businessId === null ? undefined : toBusinessId(businessId);
  }
}
