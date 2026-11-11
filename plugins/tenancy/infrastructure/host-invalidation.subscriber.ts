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
      void this.drop(message, channel === LEGACY_HOST_INVALIDATE_CHANNEL);
    });
    try {
      // The legacy channel too, for processes of the previous release during the deploy (D309).
      await this.redis.subscribe(hostInvalidateChannel(this.namespace), LEGACY_HOST_INVALIDATE_CHANNEL);
    } catch (error) {
      Logger.error(`Could not subscribe to the host invalidation channels: ${String(error)}`, LOG_CONTEXT);
    }
  }

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }

  private async drop(message: string, fromPreviousRelease: boolean): Promise<void> {
    try {
      const hosts = parseHosts(message);
      await this.local.delete(hosts);
      if (fromPreviousRelease) await this.shared?.delete(hosts);
    } catch (error) {
      Logger.error(`Ignored the invalidation message '${message}': ${String(error)}`, LOG_CONTEXT);
    }
  }
}
