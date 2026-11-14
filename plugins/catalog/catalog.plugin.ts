import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CatalogTranslations } from './api/catalog-translations';
import { ProductActions } from './api/product-actions';
import { ProductReadUseCases, ProductWriteUseCases } from './api/product-use-cases';
import { ProductReadController } from './api/product-read.controller';
import { ProductsController } from './api/products.controller';
import { ProductsResolver } from './api/products.resolver';
import { RestI18nMiddleware } from './api/rest-i18n.middleware';
import { catalogAdminApiSchema } from './api/schema';
import { BrandsController } from './api/brands.controller';
import { HighlightsController } from './api/highlights.controller';
import { TagsController } from './api/tags.controller';
import { TaxonomyActions } from './api/taxonomy-actions';
import { TaxonomyResolver } from './api/taxonomy.resolver';
import { ORDER_MANAGER_CHECK_REGISTRAR } from './application/tokens';
import { CatalogProductQueries } from './infrastructure/catalog-product-queries';
import { CATALOG_ENTITIES } from './infrastructure/catalog-entities';
import { configureCatalogCustomFields } from './infrastructure/custom-fields';
import { PRODUCT_PROVIDERS } from './infrastructure/product.providers';

/** Every REST controller; the product read controller first, its `slug-availability` route before `:id` (D2103). */
const CONTROLLERS = [ProductReadController, ProductsController, BrandsController, TagsController, HighlightsController];

/**
 * The store catalog: products and variants on Vendure's own entities, with our fields and tables beside them
 * (D2100), and the store's brands, tags and highlights. This module only wires the layers; Tasks 13-17 add more.
 */
@VendurePlugin({
  // `requirePermission` applies `@TenantScoped()`, whose guard resolves through tenancy's exports; product changes
  // go out through the outbox in the write transaction (D2127).
  imports: [PluginCommonModule, TenancyPlugin, PlatformOutboxPlugin],
  entities: CATALOG_ENTITIES,
  configuration: configureCatalogCustomFields,
  providers: [
    ...PRODUCT_PROVIDERS,
    ProductWriteUseCases,
    ProductReadUseCases,
    ProductActions,
    TaxonomyActions,
    CatalogTranslations,
    CatalogProductQueries,
  ],
  // The read facade of later sessions (D2104) and the registrar team's order-manager check joins (D2114); other
  // plugins inject them from their infrastructure.
  exports: [CatalogProductQueries, ORDER_MANAGER_CHECK_REGISTRAR],
  adminApiExtensions: {
    schema: catalogAdminApiSchema,
    resolvers: [ProductsResolver, TaxonomyResolver],
  },
  controllers: CONTROLLERS,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
export class CatalogPlugin implements NestModule {
  /** REST refusals are translated, like GraphQL ones. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RestI18nMiddleware).forRoutes(...CONTROLLERS);
  }
}
