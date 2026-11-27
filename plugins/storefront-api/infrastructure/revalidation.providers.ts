import { PLATFORM_CLOCK, type PlatformClock } from '@cod/plugin-platform-jobs';
import { PlatformStoreLookup } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { PurgeCoalescer } from '../application/purge-coalescer';
import { StorefrontRevalidation } from '../application/storefront-revalidation.service';
import { PROJECTION_REBUILD_QUEUE_PORT, PROJECTION_REBUILDER, REVALIDATION_QUEUE_PORT } from '../application/tokens';
import type { CdnPurgePort } from '../domain/ports/cdn-purge.port';
import type { StorefrontRevalidatorPort } from '../domain/ports/storefront-revalidator.port';
import { CloudflareCdnPurge } from './cloudflare-cdn-purge.adapter';
import { HttpStorefrontRevalidator } from './http-storefront-revalidator';
import { NoopCdnPurge } from './noop-cdn-purge.adapter';
import { DEFAULT_PURGE_PLATFORM_DOMAIN, type StorefrontApiPluginOptions } from './plugin-options';
import { ProjectionBackfill } from './projection-backfill';
import { PlatformProjectionRebuildQueue, ProjectionRebuildJob } from './projection-rebuild.job';
import { StorefrontRevalidateConsumer } from './revalidate.consumer';
import { PlatformRevalidationQueue, StorefrontRevalidateWorker } from './storefront-revalidate.worker';
import { TenancyStoreHosts } from './tenancy-store-hosts.adapter';
import { UnconfiguredStorefrontRevalidator } from './unconfigured-storefront-revalidator';

const LOG_CONTEXT = 'StorefrontRevalidate';

function revalidatorOf(options: StorefrontApiPluginOptions): StorefrontRevalidatorPort {
  const target = options.storefront;
  if (target === undefined) return new UnconfiguredStorefrontRevalidator();
  return new HttpStorefrontRevalidator({ baseUrl: target.internalUrl, signingKey: target.signingKey });
}

/** The Cloudflare purge when the host gave a zone and a token, otherwise the logging no-op (D3210). */
export function cdnPurgeOf(options: StorefrontApiPluginOptions): CdnPurgePort {
  return options.cloudflare === undefined ? new NoopCdnPurge() : new CloudflareCdnPurge(options.cloudflare);
}

/**
 * The revalidation pipeline (Task 11): outbox consumer → `storefront-revalidate` job → signed storefront call and a
 * coalesced CDN purge, plus the projection rebuild a settings change queues. `options` is read when Nest builds the
 * providers, after `StorefrontApiPlugin.init`.
 */
export function revalidationProviders(options: () => StorefrontApiPluginOptions): Provider[] {
  return [
    { provide: REVALIDATION_QUEUE_PORT, useClass: PlatformRevalidationQueue },
    { provide: PROJECTION_REBUILD_QUEUE_PORT, useClass: PlatformProjectionRebuildQueue },
    { provide: PROJECTION_REBUILDER, useExisting: ProjectionBackfill },
    {
      provide: StorefrontRevalidation,
      useFactory: (stores: PlatformStoreLookup, clock: PlatformClock) =>
        new StorefrontRevalidation({
          revalidator: revalidatorOf(options()),
          hosts: new TenancyStoreHosts(stores, options().platformDomain ?? DEFAULT_PURGE_PLATFORM_DOMAIN),
          purge: cdnPurgeOf(options()),
          coalescer: new PurgeCoalescer(() => clock.now()),
          log: {
            warn: (message) => {
              Logger.warn(message, LOG_CONTEXT);
            },
          },
        }),
      inject: [PlatformStoreLookup, PLATFORM_CLOCK],
    },
    StorefrontRevalidateConsumer,
    StorefrontRevalidateWorker,
    ProjectionRebuildJob,
  ];
}
