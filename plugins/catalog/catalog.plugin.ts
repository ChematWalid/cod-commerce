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
import { CatalogProductQueries } from './infrastructure/catalog-product-queries';
import { CATALOG_ENTITIES } from './infrastructure/catalog-entities';
import { configureCatalogCustomFields } from './infrastructure/custom-fields';
import { PRODUCT_PROVIDERS } from './infrastructure/product.providers';

/**
 * The store catalog: products and variants on Vendure's own entities, with our fields and tables beside them
 * (D2100). This module only wires the layers; Tasks 12-17 add more use cases and API.
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
    CatalogTranslations,
    CatalogProductQueries,
  ],
  // The read facade of later sessions (D2104); they inject it from their infrastructure.
  exports: [CatalogProductQueries],
  adminApiExtensions: {
    schema: catalogAdminApiSchema,
    resolvers: [ProductsResolver],
  },
  // The read controller first: its fixed `slug-availability` route must be declared before `:id` (D2103).
  controllers: [ProductReadController, ProductsController],
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
export class CatalogPlugin implements NestModule {
  /** REST refusals are translated, like GraphQL ones. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RestI18nMiddleware).forRoutes(ProductReadController, ProductsController);
  }
}
