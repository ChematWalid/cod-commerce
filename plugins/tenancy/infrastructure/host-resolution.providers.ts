import type { Provider } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { Redis, type RedisOptions } from 'ioredis';
import { ResolveHostService } from '../application/resolve-host.service';
import { HOST_LOCAL_CACHE, HOST_SHARED_CACHE, STORE_HOST_INVALIDATOR } from '../application/tokens';
import type { HostCachePort } from '../domain/ports/host-cache.port';
import { HostInvalidationSubscriber } from './host-invalidation.subscriber';
import { HostInvalidator } from './host-invalidator';
import { LruHostCache } from './lru';
import { PlatformStoreLookup } from './platform-store-lookup';
import { HOST_CACHE_REDIS_OPTIONS, ValkeyHostCache } from './valkey-host-cache';

const LOG_CONTEXT = 'HostResolution';

/** What the host resolver needs to know about its deployment. */
export interface HostResolutionOptions {
  readonly redisUrl: string;
  readonly platformDomain: string;
}

function connect(redisUrl: string, options: RedisOptions): Redis {
  const redis = new Redis(redisUrl, options);
  redis.on('error', (error: Error) => {
    Logger.warn(`Valkey: ${error.message}`, LOG_CONTEXT);
  });
  return redis;
}

/**
 * The host resolver's providers. `options` is read when Nest builds them, after `TenancyPlugin.init`.
 * Commands fail fast so a Valkey outage falls through to the database; the subscriber retries for ever, so it
 * subscribes whenever Valkey comes back.
 */
export function hostResolutionProviders(options: () => HostResolutionOptions): Provider[] {
  return [
    { provide: HOST_LOCAL_CACHE, useFactory: () => new LruHostCache() },
    {
      provide: HOST_SHARED_CACHE,
      useFactory: () => new ValkeyHostCache(connect(options().redisUrl, HOST_CACHE_REDIS_OPTIONS)),
    },
    {
      provide: HostInvalidationSubscriber,
      useFactory: (local: HostCachePort) =>
        new HostInvalidationSubscriber(connect(options().redisUrl, { maxRetriesPerRequest: null }), local),
      inject: [HOST_LOCAL_CACHE],
    },
    {
      provide: ResolveHostService,
      useFactory: (local: HostCachePort, shared: HostCachePort, lookup: PlatformStoreLookup) =>
        new ResolveHostService({ local, shared, lookup, platformDomain: options().platformDomain }),
      inject: [HOST_LOCAL_CACHE, HOST_SHARED_CACHE, PlatformStoreLookup],
    },
    {
      provide: HostInvalidator,
      useFactory: (shared: ValkeyHostCache, local: HostCachePort, lookup: PlatformStoreLookup) =>
        new HostInvalidator(shared, local, lookup, options().platformDomain),
      inject: [HOST_SHARED_CACHE, HOST_LOCAL_CACHE, PlatformStoreLookup],
    },
    { provide: STORE_HOST_INVALIDATOR, useExisting: HostInvalidator },
  ];
}
