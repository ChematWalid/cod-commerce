import { describe, expect, it, type Mock, vi } from 'vitest';
import { CachingStoreResolver } from '../../src/tenancy/caching-store-resolver';
import { normalizeHost, type NormalizedHost } from '../../src/tenancy/host';
import {
  STORE_LRU_MAX_ENTRIES,
  STORE_LRU_NEGATIVE_TTL_MS,
  STORE_LRU_POSITIVE_TTL_MS,
  StoreLru,
} from '../../src/tenancy/store-lru';
import type { ResolvedStore, StoreResolver } from '../../src/tenancy/store-resolver';

const DEMO: ResolvedStore = {
  storeId: '100',
  businessId: '200',
  name: 'Demo Store',
  logo: null,
  defaultLocale: 'ar',
  primaryHost: 'demo.localhost' as NormalizedHost,
  status: 'active',
};

const host = (raw: string): NormalizedHost => normalizeHost(raw) as NormalizedHost;

/** A clock the tests move by hand. */
function manualClock(): { now: () => number; advance: (ms: number) => void } {
  let time = 1_000_000;
  return { now: () => time, advance: (ms) => (time += ms) };
}

/** A resolver that knows `demo.localhost` only, with its `resolveByHost` mock apart to count the calls. */
interface CountingResolver {
  readonly resolver: StoreResolver;
  readonly resolveByHost: Mock<(host: NormalizedHost) => Promise<ResolvedStore | null>>;
}

function countingResolver(): CountingResolver {
  const resolveByHost = vi.fn((asked: NormalizedHost) => Promise.resolve(asked === 'demo.localhost' ? DEMO : null));
  return { resolveByHost, resolver: { resolveByHost, findById: () => Promise.resolve(DEMO) } };
}

function cachingResolver(inner: CountingResolver, now: () => number = Date.now): CachingStoreResolver {
  return new CachingStoreResolver(inner.resolver, { lru: new StoreLru({ now }), platformDomain: () => 'localhost' });
}

describe('StoreLru', () => {
  it('keeps a found store for 60 s', () => {
    // Arrange
    const clock = manualClock();
    const lru = new StoreLru({ now: clock.now });
    lru.set('demo.localhost', DEMO);
    // Act
    clock.advance(STORE_LRU_POSITIVE_TTL_MS - 1);
    const fresh = lru.get('demo.localhost');
    clock.advance(1);
    const expired = lru.get('demo.localhost');
    // Assert
    expect(fresh).toEqual({ store: DEMO });
    expect(expired).toBeUndefined();
  });

  it('keeps an unknown host for 15 s', () => {
    // Arrange
    const clock = manualClock();
    const lru = new StoreLru({ now: clock.now });
    lru.set('nope.localhost', null);
    // Act
    clock.advance(STORE_LRU_NEGATIVE_TTL_MS - 1);
    const fresh = lru.get('nope.localhost');
    clock.advance(1);
    const expired = lru.get('nope.localhost');
    // Assert
    expect(fresh).toEqual({ store: null });
    expect(expired).toBeUndefined();
  });

  it('shares one entry between spellings of the same host', () => {
    // Arrange
    const lru = new StoreLru();
    // Act
    lru.set('Demo.LOCALHOST.', DEMO);
    // Assert
    expect(lru.get('demo.localhost:3001')).toEqual({ store: DEMO });
    expect(lru.size).toBe(1);
  });

  it('evicts the least recently used host past 10 000 entries', () => {
    // Arrange
    const lru = new StoreLru();
    for (let index = 0; index < STORE_LRU_MAX_ENTRIES; index += 1) lru.set(`s${String(index)}.localhost`, null);
    lru.get('s0.localhost');
    // Act
    lru.set('extra.localhost', null);
    // Assert
    expect(lru.size).toBe(STORE_LRU_MAX_ENTRIES);
    expect(lru.get('s0.localhost')).toBeDefined();
    expect(lru.get('s1.localhost')).toBeUndefined();
  });
});

describe('CachingStoreResolver', () => {
  it('answers a host outside the platform domain with no store and no api call', async () => {
    // Arrange
    const inner = countingResolver();
    // Act
    const store = await cachingResolver(inner).resolveByHost(host('x.example.com'));
    // Assert
    expect(store).toBeNull();
    expect(inner.resolveByHost).not.toHaveBeenCalled();
  });

  it('asks the api once for two resolves of the same unknown host', async () => {
    // Arrange
    const inner = countingResolver();
    const resolver = cachingResolver(inner);
    // Act
    await resolver.resolveByHost(host('nope.localhost'));
    const second = await resolver.resolveByHost(host('nope.localhost'));
    // Assert
    expect(second).toBeNull();
    expect(inner.resolveByHost).toHaveBeenCalledTimes(1);
  });

  it('shares one api call between concurrent resolves of the same host', async () => {
    // Arrange
    const inner = countingResolver();
    const resolver = cachingResolver(inner);
    // Act
    const stores = await Promise.all([
      resolver.resolveByHost(host('demo.localhost')),
      resolver.resolveByHost(host('demo.localhost')),
    ]);
    // Assert
    expect(stores).toEqual([DEMO, DEMO]);
    expect(inner.resolveByHost).toHaveBeenCalledTimes(1);
  });

  it('asks the api again once a found store is older than 60 s', async () => {
    // Arrange
    const clock = manualClock();
    const inner = countingResolver();
    const resolver = cachingResolver(inner, clock.now);
    await resolver.resolveByHost(host('demo.localhost'));
    // Act
    clock.advance(STORE_LRU_POSITIVE_TTL_MS);
    await resolver.resolveByHost(host('demo.localhost'));
    // Assert
    expect(inner.resolveByHost).toHaveBeenCalledTimes(2);
  });

  it('does not remember an api failure, so an outage never becomes an unknown store', async () => {
    // Arrange
    const inner = countingResolver();
    inner.resolveByHost.mockRejectedValueOnce(new Error('connection refused'));
    const resolver = cachingResolver(inner);
    // Act
    const first = resolver.resolveByHost(host('demo.localhost'));
    // Assert
    await expect(first).rejects.toThrow('connection refused');
    await expect(resolver.resolveByHost(host('demo.localhost'))).resolves.toEqual(DEMO);
  });
});
