import type { BusinessId } from '@cod/shared';
import type { Permission, RequestContext } from '@vendure/core';
import type { StoreActor } from '../domain/store';
import { tenantOf } from './tenant-of';

/**
 * The caller as the store use cases see it. `@Allow` checks the request's channel only, so the channels holding
 * `permission` are passed down to stop a store being reached through a permission held on a different one.
 */
export function storeActorOf(ctx: RequestContext, permission: Permission): StoreActor {
  const channels = ctx.session?.user?.channelPermissions ?? [];
  return {
    businessId: tenantOf(ctx).businessId,
    channelIds: channels
      .filter((channel) => channel.permissions.includes(permission))
      .map((channel) => channel.id as number),
  };
}

/**
 * A member's reach for the switcher: every channel of the session, whatever permission it grants. Listing the
 * stores one can switch to needs a role on the store, not a particular permission.
 */
export function memberActorOf(ctx: RequestContext, businessId: BusinessId): StoreActor {
  const channels = ctx.session?.user?.channelPermissions ?? [];
  return { businessId, channelIds: channels.map((channel) => channel.id as number) };
}
