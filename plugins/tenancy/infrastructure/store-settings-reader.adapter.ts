import type { BusinessId, StoreId } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import { TENANT_STORES } from '../application/tokens';
import type { OperationContext } from '../domain/ports/operation-context';
import { type StoreSettings, StoreSettingsReader } from '../domain/ports/store-settings-reader.port';
import type { TenantStoresPort } from '../domain/ports/tenant-stores.port';

/** {@link StoreSettingsReader} over {@link TenantStoresPort}, the one place that reads a store by business and id. */
@Injectable()
export class TenantStoreSettingsReader extends StoreSettingsReader {
  constructor(@Inject(TENANT_STORES) private readonly stores: TenantStoresPort) {
    super();
  }

  async settingsOf(ctx: OperationContext, businessId: BusinessId, storeId: StoreId): Promise<StoreSettings | null> {
    const store = await this.stores.find(ctx, businessId, storeId);
    if (store === undefined) return null;
    return {
      soldOutBehavior: store.soldOutBehavior,
      language: store.language,
      channelId: store.channelId,
      status: store.status,
    };
  }
}
