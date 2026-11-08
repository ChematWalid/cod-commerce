import { Logger } from '@vendure/core';
import type { Redis } from 'ioredis';
import { HOST_INVALIDATE_CHANNEL, hostCacheKey } from '../domain/constants';
import type { HostCachePort } from '../domain/ports/host-cache.port';
import type { StoreResolution } from '../domain/store-resolution';

const LOG_CONTEXT = 'ValkeyHostCache';

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
      await this.redis.set(hostCacheKey(host), JSON.stringify(value));
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
