import type { BusinessId, StoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import { type StoreSettings, StoreSettingsReader } from '../domain/ports/store-settings-reader.port';
import { toRequestContext } from './operation-context.adapter';
import { RequestTenantScope } from './request-tenant-scope';
import { StoreEntity } from './store.entity';
import { type TenantRepository, TenantRepositoryFactory } from './tenant-repository';

/** {@link StoreSettingsReader} on `TenantRepository`: the business filter is forced, so a foreign store reads `null`. */
@Injectable()
export class TenantStoreSettingsReader extends StoreSettingsReader {
  private readonly stores: TenantRepository<StoreEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    super();
    this.stores = repositories.for(StoreEntity);
  }

  async settingsOf(ctx: OperationContext, businessId: BusinessId, storeId: StoreId): Promise<StoreSettings | null> {
    const row = await this.stores.findOne(new RequestTenantScope(toRequestContext(ctx), businessId), { id: storeId });
    if (row === null) return null;
    return {
      soldOutBehavior: row.soldOutBehavior,
      language: row.language,
      channelId: row.channelId,
      status: row.status,
    };
  }
}
