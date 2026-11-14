import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CATALOG_ENTITIES } from './infrastructure/catalog-entities';
import { configureCatalogCustomFields } from './infrastructure/custom-fields';

/**
 * The store catalog: products and variants on Vendure's own entities, with our fields and tables beside them
 * (D2100). This module only wires the layers; Tasks 11-17 add the use cases and the API.
 */
@VendurePlugin({
  // `requirePermission` applies `@TenantScoped()`, whose guard resolves through tenancy's exports; product changes
  // go out through the outbox in the write transaction (D2127).
  imports: [PluginCommonModule, TenancyPlugin, PlatformOutboxPlugin],
  entities: CATALOG_ENTITIES,
  configuration: configureCatalogCustomFields,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CatalogPlugin {}
