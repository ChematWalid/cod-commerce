import { describe, expect, it } from 'vitest';
import { PurgeCoalescer } from '../../application/purge-coalescer';
import { StorefrontRevalidation } from '../../application/storefront-revalidation.service';
import type { CdnPurgePort } from '../../domain/ports/cdn-purge.port';
import type { StoreHostsPort } from '../../domain/ports/store-hosts.port';
import type { StorefrontRevalidatorPort } from '../../domain/ports/storefront-revalidator.port';

const STORE_A = '7340032000000001';
const STORE_B = '7340032000000002';

class RecordingRevalidator implements StorefrontRevalidatorPort {
  readonly calls: (readonly string[])[] = [];
  failWith: Error | undefined;

  revalidate(tags: readonly string[]): Promise<void> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.calls.push(tags);
    return Promise.resolve();
  }
}

class RecordingPurge implements CdnPurgePort {
  readonly calls: (readonly string[])[] = [];
  failWith: Error | undefined;

  purgeHosts(hostnames: readonly string[]): Promise<void> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.calls.push(hostnames);
    return Promise.resolve();
  }
}

const HOSTS: Readonly<Record<string, readonly string[]>> = {
  [STORE_A]: ['a.example.dz'],
  [STORE_B]: ['b.example.dz', 'shop-b.dz'],
};

const hosts: StoreHostsPort = { hostsOf: (storeId) => Promise.resolve(HOSTS[storeId] ?? []) };

function setUp() {
  let now = 1_800_000_000_000;
  const revalidator = new RecordingRevalidator();
  const purge = new RecordingPurge();
  const warnings: string[] = [];
  const service = new StorefrontRevalidation({
    revalidator,
    hosts,
    purge,
    coalescer: new PurgeCoalescer(() => now),
    log: { warn: (message) => warnings.push(message) },
  });
  return { revalidator, purge, warnings, service, advance: (ms: number) => (now += ms) };
}

describe('StorefrontRevalidation.revalidate', () => {
  it('expires the tags on the storefront, then purges the store hostnames', async () => {
    // Arrange
    const { revalidator, purge, service } = setUp();

    // Act
    await service.revalidate(STORE_B, ['product:12', `store:${STORE_B}`]);

    // Assert
    expect(revalidator.calls).toEqual([['product:12', `store:${STORE_B}`]]);
    expect(purge.calls).toEqual([['b.example.dz', 'shop-b.dz']]);
  });

  it('fails without purging when the storefront refuses, so the job retries', async () => {
    // Arrange
    const { revalidator, purge, service } = setUp();
    revalidator.failWith = new Error('storefront down');

    // Act
    const run = service.revalidate(STORE_A, [`store:${STORE_A}`]);

    // Assert
    await expect(run).rejects.toThrow('storefront down');
    expect(purge.calls).toEqual([]);
  });

  it('logs a failed purge and still succeeds: the CDN entries expire on their own', async () => {
    // Arrange
    const { purge, warnings, service } = setUp();
    purge.failWith = new Error('cdn down');

    // Act
    await service.revalidate(STORE_A, [`store:${STORE_A}`]);

    // Assert
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('1 hostname');
  });

  it('holds a second purge of the store inside the window until a later flush', async () => {
    // Arrange
    const { purge, service, advance } = setUp();
    await service.revalidate(STORE_A, [`store:${STORE_A}`]);

    // Act
    await service.revalidate(STORE_A, ['product:5', `store:${STORE_A}`]);
    const heldBack = purge.calls.length;
    advance(30_000);
    const flushed = await service.flushPurges();

    // Assert
    expect(heldBack).toBe(1);
    expect(flushed).toBe(1);
    expect(purge.calls).toHaveLength(2);
  });
});
