import { Logger } from '@vendure/core';
import type { Redis, RedisOptions } from 'ioredis';
import {
  HOST_CACHE_COMMAND_TIMEOUT_MS,
  HOST_CACHE_DEFAULT_NAMESPACE,
  HOST_CACHE_TTL_SECONDS,
  hostCacheKey,
  hostInvalidateChannel,
  LEGACY_HOST_INVALIDATE_CHANNEL,
  legacyHostCacheKey,
} from '../domain/constants';
import type { HostCachePort } from '../domain/ports/host-cache.port';
import { isStoreResolution, type StoreResolution } from '../domain/store-resolution';

const LOG_CONTEXT = 'ValkeyHostCache';

/**
 * Fail fast: without the offline queue a command made during an outage is refused at once instead of waiting for
 * a reconnect, and the timeout covers a Valkey that accepts commands but does not answer. Needs an eager
 * connection: with `lazyConnect` the first command would be refused.
 */
export const HOST_CACHE_REDIS_OPTIONS: RedisOptions = {
  enableOfflineQueue: false,
  commandTimeout: HOST_CACHE_COMMAND_TIMEOUT_MS,
  maxRetriesPerRequest: 1,
};

/**
 * The tier every process shares. A failed read or write only costs a database read, so both are logged and the
 * request carries on; deletes and publishes throw, because their caller must report what was left behind.
 * Keys and invalidations live under `namespace` (the environment). An entry that is not a store resolution is a
 * miss.
 */
export class ValkeyHostCache implements HostCachePort {
  constructor(
    private readonly redis: Redis,
    private readonly namespace: string = HOST_CACHE_DEFAULT_NAMESPACE,
  ) {}

  async get(host: string): Promise<StoreResolution | null> {
    try {
      const raw = await this.redis.get(this.keyOf(host));
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (isStoreResolution(parsed)) return parsed;
      Logger.warn(`Ignored a malformed cache entry for host '${host}'`, LOG_CONTEXT);
      return null;
    } catch (error) {
      Logger.warn(`Could not read host '${host}' from Valkey: ${String(error)}`, LOG_CONTEXT);
      return null;
    }
  }

  async set(host: string, value: StoreResolution): Promise<void> {
    try {
      await this.redis.set(this.keyOf(host), JSON.stringify(value), 'EX', HOST_CACHE_TTL_SECONDS);
    } catch (error) {
      Logger.warn(`Could not write host '${host}' to Valkey: ${String(error)}`, LOG_CONTEXT);
    }
  }

  async delete(hosts: readonly string[]): Promise<void> {
    // The legacy keys too: a process of the previous release may still write them during the deploy (D309).
    await this.redis.del(...hosts.flatMap((host) => [this.keyOf(host), legacyHostCacheKey(host)]));
  }

  /** Tells every process to drop `hosts` from memory. */
  async publish(hosts: readonly string[]): Promise<void> {
    const message = JSON.stringify(hosts);
    await this.redis.publish(hostInvalidateChannel(this.namespace), message);
    await this.redis.publish(LEGACY_HOST_INVALIDATE_CHANNEL, message);
  }

  private keyOf(host: string): string {
    return hostCacheKey(this.namespace, host);
  }

  close(): void {
    this.redis.disconnect();
  }
}
