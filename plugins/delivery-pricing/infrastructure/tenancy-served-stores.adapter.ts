import { PlatformStoreLookup } from '@cod/plugin-tenancy';
import { type StoreId, toBusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { ServedStoresPort } from '../domain/ports/served-stores.port';
import type { StoreScope } from '../domain/store-scope';

/**
 * {@link ServedStoresPort} over tenancy's {@link PlatformStoreLookup}, the store-by-id read geo's signed route checks
 * its `storeId` with (D3130): only an active store of an active business is found, with the business that owns it.
 */
@Injectable()
export class TenancyServedStores implements ServedStoresPort {
  constructor(private readonly lookup: PlatformStoreLookup) {}

  async scopeOf(storeId: StoreId): Promise<StoreScope | null> {
    const row = await this.lookup.findById(storeId);
    return row === null ? null : { businessId: toBusinessId(row.businessId), storeId };
  }
}
