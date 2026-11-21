import { tenantOf } from '@cod/plugin-tenancy';
import type { RequestContext } from '@vendure/core';
import type { StoreScope } from '../domain/store-scope';

/** The caller's business and active store, as the tenant guard resolved them (never from the path or channel, D2236). */
export function scopeOf(ctx: RequestContext): StoreScope {
  const { businessId, activeStoreId } = tenantOf(ctx);
  return { businessId, storeId: activeStoreId };
}
