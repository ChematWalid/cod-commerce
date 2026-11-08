import { type StoreId, toStoreId } from '@cod/shared';
import { Logger } from '@vendure/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOST_INVALIDATE_RETRIES, HOST_INVALIDATE_RETRY_BASE_MS, HOST_REDELETE_DELAY_MS } from '../../domain/constants';
import type { HostCachePort } from '../../domain/ports/host-cache.port';
import { HostInvalidator } from '../../infrastructure/host-invalidator';

const STORE: StoreId = toStoreId('100');
/** The sum of every retry's backoff: 1 + 2 + 4 + ... */
const RETRY_WINDOW_MS = HOST_INVALIDATE_RETRY_BASE_MS * (2 ** HOST_INVALIDATE_RETRIES - 1);

function setup(customDomains: readonly string[] = []): {
  invalidator: HostInvalidator;
  shared: { delete: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  local: { delete: ReturnType<typeof vi.fn> };
} {
  const shared = {
    delete: vi.fn(() => Promise.resolve()),
    publish: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
  };
  const local = { delete: vi.fn(() => Promise.resolve()) };
  const lookup = { findCustomDomains: () => Promise.resolve(customDomains) };
  const invalidator = new HostInvalidator(shared, local as unknown as HostCachePort, lookup, 'localhost');
  return { invalidator, shared, local };
}

describe('HostInvalidator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deletes, publishes and drops every host of the store', async () => {
    // Arrange
    const { invalidator, shared, local } = setup(['shop.example.test']);
    const hosts = ['old.localhost', 'new.localhost', 'shop.example.test'];

    // Act
    await invalidator.invalidate({ storeId: STORE, subdomains: ['old', 'new'] });

    // Assert
    expect(shared.delete).toHaveBeenCalledWith(hosts);
    expect(shared.publish).toHaveBeenCalledWith(hosts);
    expect(local.delete).toHaveBeenCalledWith(hosts);
  });

  it('deletes again after the delay, for a resolver that read before the commit', async () => {
    // Arrange
    const { invalidator, shared } = setup();
    await invalidator.invalidate({ storeId: STORE, subdomains: ['old'] });
    expect(shared.delete).toHaveBeenCalledTimes(1);

    // Act
    await vi.advanceTimersByTimeAsync(HOST_REDELETE_DELAY_MS);

    // Assert
    expect(shared.delete).toHaveBeenCalledTimes(2);
  });

  it('logs a publish failure and still finishes the sweep', async () => {
    // Arrange
    const error = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const { invalidator, shared, local } = setup();
    shared.publish.mockRejectedValueOnce(new Error('valkey gone'));

    // Act
    await invalidator.invalidate({ storeId: STORE, subdomains: ['old'] });

    // Assert
    expect(error).toHaveBeenCalledWith(expect.stringContaining('old.localhost'), expect.any(String));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('valkey gone'), expect.any(String));
    expect(local.delete).toHaveBeenCalledTimes(1);
  });

  it('retries a failing delete with backoff for about 30 s, then logs that it gave up', async () => {
    // Arrange
    const error = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const { invalidator, shared } = setup();
    shared.delete.mockRejectedValue(new Error('valkey gone'));
    await invalidator.invalidate({ storeId: STORE, subdomains: ['old'] });

    // Act
    await vi.advanceTimersByTimeAsync(HOST_REDELETE_DELAY_MS + RETRY_WINDOW_MS);

    // Assert: the first sweep, the delayed one, then every retry.
    expect(shared.delete).toHaveBeenCalledTimes(2 + HOST_INVALIDATE_RETRIES);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Gave up'), expect.any(String));
  });

  it('stops retrying once a delete goes through', async () => {
    // Arrange
    const { invalidator, shared } = setup();
    vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    shared.delete.mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'));
    await invalidator.invalidate({ storeId: STORE, subdomains: ['old'] });

    // Act
    await vi.advanceTimersByTimeAsync(HOST_REDELETE_DELAY_MS + RETRY_WINDOW_MS);

    // Assert: failed, failed at the delay, succeeded on the first retry.
    expect(shared.delete).toHaveBeenCalledTimes(3);
  });

  it('runs a pending re-delete on shutdown, then closes the cache', async () => {
    // Arrange
    const { invalidator, shared } = setup();
    await invalidator.invalidate({ storeId: STORE, subdomains: ['old'] });

    // Act
    await invalidator.onApplicationShutdown();

    // Assert
    expect(shared.delete).toHaveBeenCalledTimes(2);
    expect(shared.close).toHaveBeenCalledTimes(1);
  });
});
