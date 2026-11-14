import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * Store collections (P2.S3): a Vendure `Collection` in the store channel for identity and texts, with our rule,
 * mode, visibility, position and ordered membership beside it (D2300). This module only wires the layers.
 */
@VendurePlugin({
  // `requirePermission` applies `@TenantScoped()`, whose guard resolves through tenancy's exports; membership follows
  // `product.changed` through the outbox (D2312), the store reconcile runs on the `catalog-effects` pool (D2336), the
  // preview is throttled (D2338) and product facts come from the catalog's extension points (D2308, D2309).
  imports: [
    PluginCommonModule,
    TenancyPlugin,
    PlatformOutboxPlugin,
    PlatformJobsPlugin,
    RateLimitPlugin,
    CatalogPlugin,
  ],
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CollectionsRulesPlugin {}
