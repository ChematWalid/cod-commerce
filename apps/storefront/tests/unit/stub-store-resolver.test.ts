import { describe, expect, it } from 'vitest';
import type { NormalizedHost } from '../../src/tenancy/host';
import { STUB_STORES, StubStoreResolver } from '../../src/tenancy/stub-store-resolver';

const host = (value: string): NormalizedHost => value as NormalizedHost;

describe('StubStoreResolver', () => {
  it('resolves two hosts to two different stores', async () => {
    // Arrange
    const resolver = new StubStoreResolver(STUB_STORES);
    // Act
    const demo = await resolver.resolveByHost(host('demo.localhost'));
    const second = await resolver.resolveByHost(host('second.localhost'));
    // Assert
    expect(demo?.storeId).toBe('demo');
    expect(second?.storeId).toBe('second');
    expect(demo?.businessId).not.toBe(second?.businessId);
  });

  it('returns null for an unknown host', async () => {
    const resolver = new StubStoreResolver(STUB_STORES);
    await expect(resolver.resolveByHost(host('nope.localhost'))).resolves.toBeNull();
  });

  it('finds a store by id', async () => {
    const resolver = new StubStoreResolver(STUB_STORES);
    const store = await resolver.findById('demo');
    expect(store?.name).toBe('Demo Store');
  });
});
