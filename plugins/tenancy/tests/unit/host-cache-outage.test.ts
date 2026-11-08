import { Redis } from 'ioredis';
import { afterEach, describe, expect, it } from 'vitest';
import { ResolveHostService } from '../../application/resolve-host.service';
import type { HostStoreLookupPort } from '../../domain/ports/host-store-lookup.port';
import { LruHostCache } from '../../infrastructure/lru';
import { HOST_CACHE_REDIS_OPTIONS, ValkeyHostCache } from '../../infrastructure/valkey-host-cache';

/** Nothing listens on this port, so connections are refused as in a Valkey outage. */
const CLOSED_PORT_URL = 'redis://127.0.0.1:1';
/** Well under the storefront's 3 s timeout. */
const LIMIT_MS = 500;

const lookup = {
  findBySubdomain: () =>
    Promise.resolve({
      storeId: '100',
      businessId: '200',
      language: 'ar',
      name: 'Demo Store',
      logo: null,
      subdomain: 'demo',
    }),
} as unknown as HostStoreLookupPort;

describe('host resolution during a Valkey outage', () => {
  const redis = new Redis(CLOSED_PORT_URL, HOST_CACHE_REDIS_OPTIONS);
  redis.on('error', () => undefined);

  afterEach(() => {
    redis.disconnect();
  });

  it('answers from the database well under the storefront timeout', async () => {
    // Arrange
    const service = new ResolveHostService({
      local: new LruHostCache(),
      shared: new ValkeyHostCache(redis),
      lookup,
      platformDomain: 'localhost',
    });

    // Act
    const started = Date.now();
    const found = await service.resolve('demo.localhost');
    const elapsed = Date.now() - started;

    // Assert
    expect(found).toMatchObject({ storeId: '100' });
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });
});
