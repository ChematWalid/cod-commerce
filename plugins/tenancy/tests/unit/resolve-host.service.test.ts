import type { Snowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ResolveHostService } from '../../application/resolve-host.service';
import type { HostCachePort } from '../../domain/ports/host-cache.port';
import type { HostStoreLookupPort, HostStoreRow } from '../../domain/ports/host-store-lookup.port';
import type { StoreResolution } from '../../domain/store-resolution';

const row: HostStoreRow = {
  storeId: '100',
  businessId: '200',
  language: 'ar',
  name: 'Demo Store',
  logo: null,
  subdomain: 'demo',
};

const resolution: StoreResolution = {
  storeId: '100',
  businessId: '200',
  language: 'ar',
  name: 'Demo Store',
  logo: null,
  primaryHost: 'demo.localhost',
  status: 'active',
};

class FakeCache implements HostCachePort {
  readonly entries = new Map<string, StoreResolution>();
  reads = 0;

  get(host: string): Promise<StoreResolution | null> {
    this.reads += 1;
    return Promise.resolve(this.entries.get(host) ?? null);
  }

  set(host: string, value: StoreResolution): Promise<void> {
    this.entries.set(host, value);
    return Promise.resolve();
  }

  delete(hosts: readonly string[]): Promise<void> {
    hosts.forEach((host) => this.entries.delete(host));
    return Promise.resolve();
  }
}

class FakeLookup implements HostStoreLookupPort {
  bySubdomain = new Map<string, HostStoreRow>();
  byCustomDomain = new Map<string, HostStoreRow>();
  byId = new Map<string, HostStoreRow>();
  reads = 0;

  findBySubdomain(subdomain: string): Promise<HostStoreRow | null> {
    this.reads += 1;
    return Promise.resolve(this.bySubdomain.get(subdomain) ?? null);
  }

  findByCustomDomain(host: string): Promise<HostStoreRow | null> {
    this.reads += 1;
    return Promise.resolve(this.byCustomDomain.get(host) ?? null);
  }

  findById(id: Snowflake): Promise<HostStoreRow | null> {
    this.reads += 1;
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findCustomDomains(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }
}

function setup(): { service: ResolveHostService; local: FakeCache; shared: FakeCache; lookup: FakeLookup } {
  const local = new FakeCache();
  const shared = new FakeCache();
  const lookup = new FakeLookup();
  const service = new ResolveHostService({ local, shared, lookup, platformDomain: 'localhost' });
  return { service, local, shared, lookup };
}

describe('ResolveHostService', () => {
  it('answers from the local cache without reading Valkey', async () => {
    // Arrange
    const { service, local, shared } = setup();
    local.entries.set('demo.localhost', resolution);

    // Act
    const found = await service.resolve('demo.localhost');

    // Assert
    expect(found).toEqual(resolution);
    expect(shared.reads).toBe(0);
  });

  it('answers from Valkey without reading the database, and fills the local cache', async () => {
    // Arrange
    const { service, local, shared, lookup } = setup();
    shared.entries.set('demo.localhost', resolution);

    // Act
    const found = await service.resolve('demo.localhost');

    // Assert
    expect(found).toEqual(resolution);
    expect(lookup.reads).toBe(0);
    expect(local.entries.get('demo.localhost')).toEqual(resolution);
  });

  it('reads the database on a double miss and fills both caches', async () => {
    // Arrange
    const { service, local, shared, lookup } = setup();
    lookup.bySubdomain.set('demo', row);

    // Act
    const found = await service.resolve('demo.localhost');

    // Assert
    expect(found).toEqual(resolution);
    expect(shared.entries.get('demo.localhost')).toEqual(resolution);
    expect(local.entries.get('demo.localhost')).toEqual(resolution);
  });

  it('caches an unknown host nowhere', async () => {
    // Arrange
    const { service, local, shared } = setup();

    // Act
    const found = await service.resolve('nope.localhost');

    // Assert
    expect(found).toBeNull();
    expect(shared.entries.size).toBe(0);
    expect(local.entries.size).toBe(0);
  });

  it('finds a custom domain when the host is not a platform subdomain', async () => {
    // Arrange
    const { service, lookup } = setup();
    lookup.byCustomDomain.set('shop.example.test', row);

    // Act
    const found = await service.resolve('shop.example.test');

    // Assert
    expect(found).toEqual(resolution);
  });

  it.each(['DEMO.Localhost:3001', 'demo.localhost.', 'demo.localhost.:3001', ' Demo.LOCALHOST '])(
    'normalises %s to the demo store',
    async (host) => {
      // Arrange
      const { service, lookup } = setup();
      lookup.bySubdomain.set('demo', row);

      // Act and Assert
      await expect(service.resolve(host)).resolves.toEqual(resolution);
    },
  );

  it.each([
    ['the bare platform domain', 'localhost'],
    ['a nested host', 'a.b.localhost'],
    ['an xn-- label', 'xn--mnchen-3ya.localhost'],
    ['an empty host', ''],
    ['a bracketed IPv6 host', '[::1]:3001'],
    ['a NUL byte', 'de\0mo.localhost'],
    ['a path', 'demo.localhost/x'],
    ['a host of 254 characters', `${'a.'.repeat(120)}${'b'.repeat(14)}`],
    ['an array', ['demo.localhost', 'second.localhost']],
    ['no value', undefined],
  ])('answers null for %s', async (_label, host) => {
    // Arrange
    const { service } = setup();

    // Act and Assert
    await expect(service.resolve(host)).resolves.toBeNull();
  });

  it.each(['abc', '0', '-1', '9223372036854775808', ''])('answers null for the invalid id %s', async (id) => {
    // Arrange
    const { service, lookup } = setup();

    // Act
    const found = await service.findById(id);

    // Assert
    expect(found).toBeNull();
    expect(lookup.reads).toBe(0);
  });

  it('finds an active store by id', async () => {
    // Arrange
    const { service, lookup } = setup();
    lookup.byId.set('100', row);

    // Act and Assert
    await expect(service.findById('100')).resolves.toEqual(resolution);
  });
});
