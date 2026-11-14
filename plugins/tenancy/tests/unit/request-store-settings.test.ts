import { type BusinessId, type StoreId, type TenantContext, toBusinessId, toStoreId } from '@cod/shared';
import { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { RequestStoreSettings } from '../../api/request-store-settings';
import { TenantContextMissingError } from '../../api/tenant-context-missing.error';
import { rememberTenant } from '../../api/tenant-of';
import type { OperationContext } from '../../domain/ports/operation-context';
import { type StoreSettings, StoreSettingsReader } from '../../domain/ports/store-settings-reader.port';

const BUSINESS_A = toBusinessId('11');
const STORE_A = toStoreId('22');
const OTHER_STORE_OF_A = toStoreId('44');
const FOREIGN_STORE = toStoreId('33');
const STORES_OF_A: readonly StoreId[] = [STORE_A, OTHER_STORE_OF_A];

const SETTINGS: StoreSettings = { soldOutBehavior: 'keep', language: 'ar', channelId: 7, status: 'active' };

/** Answers for every store of business A, granted to the caller or not, and records the business it was asked for. */
class RecordingReader extends StoreSettingsReader {
  readonly businesses: BusinessId[] = [];

  settingsOf(_ctx: OperationContext, businessId: BusinessId, storeId: StoreId): Promise<StoreSettings | null> {
    this.businesses.push(businessId);
    return Promise.resolve(businessId === BUSINESS_A && STORES_OF_A.includes(storeId) ? SETTINGS : null);
  }
}

function contextOf(tenant: TenantContext): RequestContext {
  const ctx = RequestContext.empty();
  rememberTenant(ctx, tenant);
  return ctx;
}

describe('RequestStoreSettings', () => {
  it("reads the store in the request's own business", async () => {
    // Arrange
    const reader = new RecordingReader();
    const ctx = contextOf({ businessId: BUSINESS_A, storeIds: [STORE_A], activeStoreId: STORE_A });

    // Act
    const settings = await new RequestStoreSettings(reader).settingsOf(ctx, STORE_A);

    // Assert
    expect(settings).toEqual(SETTINGS);
    expect(reader.businesses).toEqual([BUSINESS_A]);
  });

  it("answers null for a store id outside the request's business, without reading it", async () => {
    // Arrange
    const reader = new RecordingReader();
    const ctx = contextOf({ businessId: BUSINESS_A, storeIds: [STORE_A], activeStoreId: STORE_A });

    // Act
    const settings = await new RequestStoreSettings(reader).settingsOf(ctx, FOREIGN_STORE);

    // Assert
    expect(settings).toBeNull();
    expect(reader.businesses).toEqual([]);
  });

  it("answers null for a store of the request's business the caller holds no role on", async () => {
    // Arrange
    const reader = new RecordingReader();
    const ctx = contextOf({ businessId: BUSINESS_A, storeIds: [STORE_A], activeStoreId: STORE_A });

    // Act
    const settings = await new RequestStoreSettings(reader).settingsOf(ctx, OTHER_STORE_OF_A);

    // Assert
    expect(settings).toBeNull();
    expect(reader.businesses).toEqual([]);
  });

  it('refuses a request that did not pass the tenant guard', async () => {
    // Arrange
    const reader = new RecordingReader();

    // Act
    const read = new RequestStoreSettings(reader).settingsOf(RequestContext.empty(), STORE_A);

    // Assert
    await expect(read).rejects.toBeInstanceOf(TenantContextMissingError);
    expect(reader.businesses).toEqual([]);
  });
});
