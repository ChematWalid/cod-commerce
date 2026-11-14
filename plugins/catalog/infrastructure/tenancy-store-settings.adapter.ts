import { asOperationContext as asTenancyContext, findTenant, StoreSettingsReader } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { idsAreEqual } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ActiveStore, StoreSettingsPort } from '../domain/ports/store-settings.port';
import { toRequestContext } from './request-scope';

/**
 * {@link StoreSettingsPort} over tenancy's {@link StoreSettingsReader} (D2106): the store is the active store of the
 * tenant the guard resolved for the request (`findTenant`), and the context's channel must be that store's channel
 * (D2142), so a caller can pair neither another business's store nor another store's channel with its own.
 */
@Injectable()
export class TenancyStoreSettings implements StoreSettingsPort {
  constructor(private readonly reader: StoreSettingsReader) {}

  async activeStoreOf(ctx: OperationContext): Promise<ActiveStore | undefined> {
    const request = toRequestContext(ctx);
    const tenant = findTenant(request);
    if (tenant === undefined) return undefined;
    const { businessId, activeStoreId } = tenant;
    const settings = await this.reader.settingsOf(asTenancyContext(request), businessId, activeStoreId);
    if (settings === null || settings.status !== 'active') return undefined;
    if (!idsAreEqual(settings.channelId, request.channelId)) return undefined;
    return { scope: { businessId, storeId: activeStoreId }, soldOutBehavior: settings.soldOutBehavior };
  }
}
