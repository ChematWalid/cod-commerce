import { asOperationContext as asTenancyContext, findTenant, StoreSettingsReader } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { idsAreEqual } from '@vendure/core';
import { CollectionsNoActiveStoreError } from '../domain/no-active-store.error';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/**
 * {@link ActiveStorePort} over tenancy's {@link StoreSettingsReader}: the store is the active store of the tenant the
 * guard resolved for the request (`findTenant`), it must be active, and the context's channel must be that store's
 * channel (D2142), so a caller can pair neither another business's store nor another store's channel with its own.
 */
@Injectable()
export class TenancyActiveStore implements ActiveStorePort {
  constructor(private readonly reader: StoreSettingsReader) {}

  /** @throws {CollectionsNoActiveStoreError} for a context without such a store. */
  async activeStoreOf(ctx: OperationContext): Promise<StoreScope> {
    const request = toRequestContext(ctx);
    const tenant = findTenant(request);
    if (tenant === undefined) throw new CollectionsNoActiveStoreError();
    const { businessId, activeStoreId } = tenant;
    const settings = await this.reader.settingsOf(asTenancyContext(request), businessId, activeStoreId);
    if (settings === null || settings.status !== 'active') throw new CollectionsNoActiveStoreError();
    if (!idsAreEqual(settings.channelId, request.channelId)) throw new CollectionsNoActiveStoreError();
    return { businessId, storeId: activeStoreId };
  }
}
