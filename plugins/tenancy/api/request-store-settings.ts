import type { StoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { asOperationContext } from '../domain/ports/operation-context';
import { type StoreSettings, StoreSettingsReader } from '../domain/ports/store-settings-reader.port';
import { tenantOf } from './tenant-of';

/**
 * The store settings a request handler may read: only a store the tenant guard resolved as reachable for the caller
 * (an active store of the request's business on whose channel the caller holds a role), so a store id taken from input
 * can steer a handler neither into another business nor into a store of the same business the caller cannot reach.
 */
@Injectable()
export class RequestStoreSettings {
  constructor(private readonly reader: StoreSettingsReader) {}

  /**
   * The settings of `storeId`, or `null`, as for a store that does not exist, when it is not among the caller's
   * reachable stores: another business's store, an archived store, or a store of the business the caller has no role
   * on. Jobs that must read an archived store use {@link StoreSettingsReader} with an explicit business.
   *
   * @throws {@link TenantContextMissingError} when the request did not pass `@TenantScoped()`
   */
  async settingsOf(ctx: RequestContext, storeId: StoreId): Promise<StoreSettings | null> {
    const { businessId, storeIds } = tenantOf(ctx);
    if (!storeIds.some((reachable) => reachable === storeId)) return null;
    return this.reader.settingsOf(asOperationContext(ctx), businessId, storeId);
  }
}
