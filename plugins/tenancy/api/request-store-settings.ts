import type { StoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { asOperationContext } from '../domain/ports/operation-context';
import { type StoreSettings, StoreSettingsReader } from '../domain/ports/store-settings-reader.port';
import { tenantOf } from './tenant-of';

/**
 * The store settings a request handler may read: always in the business the tenant guard resolved for the request,
 * so a handler never passes a business id and cannot be steered into another business by its input.
 */
@Injectable()
export class RequestStoreSettings {
  constructor(private readonly reader: StoreSettingsReader) {}

  /**
   * The settings of `storeId` in the request's business, archived stores too (check `status`), or `null` when that
   * business has no such store.
   *
   * @throws {@link TenantContextMissingError} when the request did not pass `@TenantScoped()`
   */
  async settingsOf(ctx: RequestContext, storeId: StoreId): Promise<StoreSettings | null> {
    const { businessId } = tenantOf(ctx);
    return this.reader.settingsOf(asOperationContext(ctx), businessId, storeId);
  }
}
