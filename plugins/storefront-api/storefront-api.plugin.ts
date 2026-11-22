import { CatalogPlugin } from '@cod/plugin-catalog';
import { CollectionsRulesPlugin } from '@cod/plugin-collections-rules';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { StorefrontCatalogController } from './api/storefront-catalog.controller';
import { PROJECTION_BACKFILL_TASK_ID } from './domain/constants';
import { projectionBackfillTask } from './infrastructure/projection-backfill';
import { STOREFRONT_API_PROVIDERS } from './infrastructure/storefront-api.providers';
import { StorefrontProductEntity } from './infrastructure/storefront-product.entity';
import { StorefrontSearchSynonymEntity } from './infrastructure/storefront-search-synonym.entity';

/** Every REST controller of the plugin. */
export const STOREFRONT_API_CONTROLLERS = [StorefrontCatalogController];

/**
 * The storefront's public catalog API (P3.S2): HMAC-signed REST under `/store` (D111) as the signed store (D3201),
 * over the per-store `storefront_product` projection the outbox keeps (D3205), with product pages and collections read
 * from the catalog and collections plugins (D3206). This module only wires the layers.
 */
@VendurePlugin({
  // Tenancy builds the storefront context, the outbox feeds the projection, the jobs plugin runs the backfill task,
  // the rate limiter limits per buyer (D3213), and the catalog and collections serve the public reads.
  imports: [
    PluginCommonModule,
    TenancyPlugin,
    PlatformOutboxPlugin,
    PlatformJobsPlugin,
    RateLimitPlugin,
    CatalogPlugin,
    CollectionsRulesPlugin,
  ],
  entities: [StorefrontProductEntity, StorefrontSearchSynonymEntity],
  configuration: (config) => {
    config.schedulerOptions.tasks = [
      ...config.schedulerOptions.tasks.filter((task) => task.id !== PROJECTION_BACKFILL_TASK_ID),
      projectionBackfillTask,
    ];
    return config;
  },
  providers: STOREFRONT_API_PROVIDERS,
  controllers: STOREFRONT_API_CONTROLLERS,
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StorefrontApiPlugin {}
