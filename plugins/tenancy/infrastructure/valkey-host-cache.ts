import { Logger } from '@vendure/core';
import type { Redis, RedisOptions } from 'ioredis';
import {
  HOST_CACHE_COMMAND_TIMEOUT_MS,
  HOST_CACHE_TTL_SECONDS,
  HOST_INVALIDATE_CHANNEL,
  hostCacheKey,
} from '../domain/constants';
import type { HostCachePort } from '../domain/ports/host-cache.port';
import type { StoreResolution } from '../domain/store-resolution';

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
 */
export class ValkeyHostCache implements HostCachePort {
  constructor(private readonly redis: Redis) {}

  async get(host: string): Promise<StoreResolution | null> {
    try {
      const raw = await this.redis.get(hostCacheKey(host));
      return raw === null ? null : (JSON.parse(raw) as StoreResolution);
    } catch (error) {
      Logger.warn(`Could not read host '${host}' from Valkey: ${String(error)}`, LOG_CONTEXT);
      return null;
    }
  }

  async set(host: string, value: StoreResolution): Promise<void> {
    try {
      await this.redis.set(hostCacheKey(host), JSON.stringify(value), 'EX', HOST_CACHE_TTL_SECONDS);
    } catch (error) {
      Logger.warn(`Could not write host '${host}' to Valkey: ${String(error)}`, LOG_CONTEXT);
    }
  }

  async delete(hosts: readonly string[]): Promise<void> {
    await this.redis.del(...hosts.map(hostCacheKey));
  }

  /** Tells every process to drop `hosts` from memory. */
  async publish(hosts: readonly string[]): Promise<void> {
    await this.redis.publish(HOST_INVALIDATE_CHANNEL, JSON.stringify(hosts));
  }

  close(): void {
    this.redis.disconnect();
  }
}
