import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Logger } from '@vendure/core';
import type { Redis } from 'ioredis';
import { HOST_INVALIDATE_CHANNEL } from '../domain/constants';
import type { HostCachePort } from '../domain/ports/host-cache.port';

const LOG_CONTEXT = 'HostInvalidationSubscriber';

function parseHosts(message: string): readonly string[] {
  const parsed: unknown = JSON.parse(message);
  if (!Array.isArray(parsed) || !parsed.every((host) => typeof host === 'string')) {
    throw new TypeError('expected an array of hosts');
  }
  return parsed;
}

/**
 * Drops hosts from this process's memory when any process invalidates them. Owns its connection, because a
 * subscribed connection can issue no other commands.
 */
export class HostInvalidationSubscriber implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private readonly redis: Redis,
    private readonly local: HostCachePort,
  ) {}

  onApplicationBootstrap(): void {
    // Not awaited: boot does not depend on Valkey. ioredis subscribes as soon as it connects.
    void this.start();
  }

  /** Resolves once subscribed. A failure is logged; the in-memory tier still expires by itself. */
  async start(): Promise<void> {
    this.redis.on('message', (_channel: string, message: string) => {
      void this.drop(message);
    });
    try {
      await this.redis.subscribe(HOST_INVALIDATE_CHANNEL);
    } catch (error) {
      Logger.error(`Could not subscribe to ${HOST_INVALIDATE_CHANNEL}: ${String(error)}`, LOG_CONTEXT);
    }
  }

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }

  private async drop(message: string): Promise<void> {
    try {
      await this.local.delete(parseHosts(message));
    } catch (error) {
      Logger.error(`Ignored the invalidation message '${message}': ${String(error)}`, LOG_CONTEXT);
    }
  }
}
