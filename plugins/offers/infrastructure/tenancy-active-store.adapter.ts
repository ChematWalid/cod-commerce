import { asOperationContext as asTenancyContext, findTenant, StoreSettingsReader } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { type ID, idsAreEqual } from '@vendure/core';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

type StoreSettings = Awaited<ReturnType<StoreSettingsReader['settingsOf']>>;

/** The store exists and `channelId` is its own channel, whatever its status. */
const isOnOwnChannel = (settings: StoreSettings, channelId: ID): boolean =>
  settings !== null && idsAreEqual(settings.channelId, channelId);

/** The store exists, is not archived and `channelId` is its own channel. */
const isActiveOnChannel = (settings: StoreSettings, channelId: ID): boolean =>
  isOnOwnChannel(settings, channelId) && settings?.status === 'active';

/**
 * {@link ActiveStorePort} over tenancy's {@link StoreSettingsReader} (D2408, copied from the catalog's adapter): the
 * store is the active store of the tenant the guard resolved for the request (`findTenant`), and the context's channel
 * must be that store's channel (D2142), so a caller pairs neither another business's store nor another store's
 * channel with its own. `activeStoreOf` and `isChannelOf` refuse an archived store (the reader returns it, D2408), so
 * the guarded and the scoped entry points of the pricing service agree on what can be priced; `isOwnChannelOf` accepts
 * it, for the order bookkeeping of D2447 (D2448).
 */
@Injectable()
export class TenancyActiveStore implements ActiveStorePort {
  constructor(private readonly reader: StoreSettingsReader) {}

  async activeStoreOf(ctx: OperationContext): Promise<StoreScope | undefined> {
    const request = toRequestContext(ctx);
    const tenant = findTenant(request);
    if (tenant === undefined) return undefined;
    const { businessId, activeStoreId } = tenant;
    const settings = await this.reader.settingsOf(asTenancyContext(request), businessId, activeStoreId);
    if (!isActiveOnChannel(settings, request.channelId)) return undefined;
    return { businessId, storeId: activeStoreId };
  }

  async isChannelOf(ctx: OperationContext, scope: StoreScope): Promise<boolean> {
    const { settings, channelId } = await this.settingsFor(ctx, scope);
    return isActiveOnChannel(settings, channelId);
  }

  async isOwnChannelOf(ctx: OperationContext, scope: StoreScope): Promise<boolean> {
    const { settings, channelId } = await this.settingsFor(ctx, scope);
    return isOnOwnChannel(settings, channelId);
  }

  /** `scope`'s store settings, read only within `scope`'s business, and the context's channel. */
  private async settingsFor(ctx: OperationContext, { businessId, storeId }: StoreScope) {
    const request = toRequestContext(ctx);
    const settings = await this.reader.settingsOf(asTenancyContext(request), businessId, storeId);
    return { settings, channelId: request.channelId };
  }
}
