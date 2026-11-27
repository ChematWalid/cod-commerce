import { CatalogPlugin } from '@cod/plugin-catalog';
import { CollectionsRulesPlugin } from '@cod/plugin-collections-rules';
import { DeliveryPricingPlugin } from '@cod/plugin-delivery-pricing';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { StorefrontCatalogController } from './api/storefront-catalog.controller';
import { StorefrontQuoteController } from './api/storefront-quote.controller';
import { PROJECTION_BACKFILL_TASK_ID } from './domain/constants';
import type { StorefrontApiPluginOptions } from './infrastructure/plugin-options';
import { projectionBackfillTask } from './infrastructure/projection-backfill';
import { revalidationProviders } from './infrastructure/revalidation.providers';
import { STOREFRONT_API_PROVIDERS } from './infrastructure/storefront-api.providers';
import { StorefrontProductEntity } from './infrastructure/storefront-product.entity';
import { StorefrontSearchSynonymEntity } from './infrastructure/storefront-search-synonym.entity';

/** Every REST controller of the plugin. */
export const STOREFRONT_API_CONTROLLERS = [StorefrontCatalogController, StorefrontQuoteController];

/**
 * The storefront's public catalog API (P3.S2): HMAC-signed REST under `/store` (D111) as the signed store (D3201),
 * over the per-store `storefront_product` projection the outbox keeps (D3205), with product pages and collections read
 * from the catalog and collections plugins (D3206). Catalog and store changes revalidate the storefront through the
 * outbox and a coalesced CDN purge (Task 11, D3210, D3211). The public quotes (P3.S3) price through delivery pricing
 * and the offers. This module only wires the layers.
 */
@VendurePlugin({
  // Tenancy builds the storefront context, the outbox feeds the projection, the jobs plugin runs the backfill task,
  // the rate limiter limits per buyer (D3213), the catalog and collections serve the public reads, and delivery
  // pricing answers the shipping quote (D3301).
  imports: [
    PluginCommonModule,
    TenancyPlugin,
    PlatformOutboxPlugin,
    PlatformJobsPlugin,
    RateLimitPlugin,
    CatalogPlugin,
    CollectionsRulesPlugin,
    DeliveryPricingPlugin,
  ],
  entities: [StorefrontProductEntity, StorefrontSearchSynonymEntity],
  configuration: (config) => {
    config.schedulerOptions.tasks = [
      ...config.schedulerOptions.tasks.filter((task) => task.id !== PROJECTION_BACKFILL_TASK_ID),
      projectionBackfillTask,
    ];
    return config;
  },
  providers: [...STOREFRONT_API_PROVIDERS, ...revalidationProviders(() => StorefrontApiPlugin.options)],
  controllers: STOREFRONT_API_CONTROLLERS,
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its only members are the options the host passes.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class StorefrontApiPlugin {
  /** Bare registration (plugin tests) logs revalidations instead of sending them. */
  static options: StorefrontApiPluginOptions = {};

  /** Registers the plugin with the storefront it revalidates and the platform domain its purges name. */
  static init(options: StorefrontApiPluginOptions): typeof StorefrontApiPlugin {
    StorefrontApiPlugin.options = options;
    return StorefrontApiPlugin;
  }
}
