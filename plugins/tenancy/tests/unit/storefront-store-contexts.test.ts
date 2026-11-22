import { toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { StorefrontStoreContexts } from '../../api/storefront-store-contexts';
import { storefrontStoreOf } from '../../api/storefront-store-of';
import { findTenant } from '../../api/tenant-of';
import type { StorefrontContext, StorefrontContextsPort } from '../../application/ports/storefront-contexts.port';
import type { StorefrontStoreContext } from '../../domain/storefront-store';

const STORE_A: StorefrontStoreContext = {
  storeId: toStoreId(toSnowflake('7340032000000001')),
  businessId: toBusinessId('41'),
  channelId: 3,
  soldOutBehavior: 'keep',
  language: 'fr',
};

/** Knows store A only: any other store is unknown or inactive. */
class FakeContexts implements StorefrontContextsPort<RequestContext> {
  forStore(rawStoreId: string): Promise<StorefrontContext<RequestContext> | undefined> {
    if (rawStoreId !== STORE_A.storeId) return Promise.resolve(undefined);
    return Promise.resolve({ ctx: { channelId: 3 } as unknown as RequestContext, store: STORE_A });
  }
}

describe('StorefrontStoreContexts', () => {
  it('hands out the store context with the store as tenant and storefront store, as the guard does', async () => {
    // Arrange
    const contexts = new StorefrontStoreContexts(new FakeContexts());

    // Act
    const ctx = await contexts.forStore(STORE_A.storeId);

    // Assert
    expect(ctx).toBeDefined();
    expect(findTenant(ctx as RequestContext)).toEqual({
      businessId: STORE_A.businessId,
      storeIds: [STORE_A.storeId],
      activeStoreId: STORE_A.storeId,
    });
    expect(storefrontStoreOf(ctx as RequestContext)).toEqual(STORE_A);
  });

  it('answers undefined for an unknown, inactive or malformed store', async () => {
    // Arrange
    const contexts = new StorefrontStoreContexts(new FakeContexts());

    // Act / Assert
    expect(await contexts.forStore('7340032000000009')).toBeUndefined();
    expect(await contexts.forStore('abc')).toBeUndefined();
  });
});
