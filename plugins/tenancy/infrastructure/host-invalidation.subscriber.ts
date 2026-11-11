import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Logger } from '@vendure/core';
import type { Redis } from 'ioredis';
import {
  HOST_CACHE_DEFAULT_NAMESPACE,
  hostInvalidateChannel,
  LEGACY_HOST_INVALIDATE_CHANNEL,
} from '../domain/constants';
import type { HostCachePort } from '../domain/ports/host-cache.port';

const LOG_CONTEXT = 'HostInvalidationSubscriber';

/** How long a payload heard on this release's channel marks its legacy copy as this release's own. */
const OWN_PAYLOAD_MEMORY_MS = 5000;

function parseHosts(message: string): readonly string[] {
  const parsed: unknown = JSON.parse(message);
  if (!Array.isArray(parsed) || !parsed.every((host) => typeof host === 'string')) {
    throw new TypeError('expected an array of hosts');
  }
  return parsed;
}

/** What the subscriber deletes in the shared tier when a process of the previous release invalidates. */
export type SharedHostDelete = Pick<HostCachePort, 'delete'>;

/**
 * Drops hosts from this process's memory when any process invalidates them. Owns its connection, because a
 * subscribed connection can issue no other commands.
 *
 * For one release it also hears the legacy channel (D309, removal in #223). A process of the previous release
 * deletes only the legacy key, so for its messages the subscriber also deletes the namespaced key in `shared`.
 */
export class HostInvalidationSubscriber implements OnApplicationBootstrap, OnApplicationShutdown {
  /** Payloads heard on this release's channel, by arrival time: their legacy copy needs no shared delete. */
  private readonly recentOwnPayloads = new Map<string, number>();

  constructor(
    private readonly redis: Redis,
    private readonly local: HostCachePort,
    private readonly namespace: string = HOST_CACHE_DEFAULT_NAMESPACE,
    private readonly shared?: SharedHostDelete,
  ) {}

  onApplicationBootstrap(): void {
    // Not awaited: boot does not depend on Valkey. ioredis subscribes as soon as it connects.
    void this.start();
  }

  /** Resolves once subscribed. A failure is logged; the in-memory tier still expires by itself. */
  async start(): Promise<void> {
    this.redis.on('message', (channel: string, message: string) => {
      void this.drop(message, this.isFromPreviousRelease(channel, message));
    });
    try {
      // The legacy channel too, for processes of the previous release during the deploy (D309).
      await this.redis.subscribe(hostInvalidateChannel(this.namespace), LEGACY_HOST_INVALIDATE_CHANNEL);
    } catch (error) {
      Logger.error(`Could not subscribe to the host invalidation channels: ${String(error)}`, LOG_CONTEXT);
    }
  }

  private async deleteShared(hosts: readonly string[]): Promise<void> {
    try {
      await this.shared?.delete(hosts);
    } catch (error) {
      Logger.error(`Could not delete hosts ${hosts.join(', ')} from Valkey: ${String(error)}`, LOG_CONTEXT);
    }
  }

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }

  /**
   * A legacy-channel message is from the previous release unless this release just sent the same payload on its
   * own channel too (it publishes on both, own channel first).
   */
  private isFromPreviousRelease(channel: string, message: string): boolean {
    const now = Date.now();
    for (const [payload, heardAt] of this.recentOwnPayloads) {
      if (now - heardAt > OWN_PAYLOAD_MEMORY_MS) this.recentOwnPayloads.delete(payload);
    }
    if (channel !== LEGACY_HOST_INVALIDATE_CHANNEL) {
      this.recentOwnPayloads.set(message, now);
      return false;
    }
    return !this.recentOwnPayloads.delete(message);
  }

  private async drop(message: string, fromPreviousRelease: boolean): Promise<void> {
    try {
      const hosts = parseHosts(message);
      // Shared tier first: dropping memory first would let a request re-read the stale shared value into memory.
      if (fromPreviousRelease) await this.deleteShared(hosts);
      await this.local.delete(hosts);
    } catch (error) {
      Logger.error(`Ignored the invalidation message '${message}': ${String(error)}`, LOG_CONTEXT);
    }
  }
}
