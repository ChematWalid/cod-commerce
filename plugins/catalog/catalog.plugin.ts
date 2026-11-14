import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CatalogTranslations } from './api/catalog-translations';
import { MediaActions } from './api/media-actions';
import { MediaController } from './api/media.controller';
import { MediaResolver } from './api/media.resolver';
import { MediaThrottle } from './api/media-throttle';
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
const CONTROLLERS = [
  ProductReadController,
  ProductsController,
  BrandsController,
  TagsController,
  HighlightsController,
  MediaController,
];

/**
 * The store catalog: products and variants on Vendure's own entities, with our fields and tables beside them
 * (D2100), the store's brands, tags and highlights, and the business's media library (D2113). This module only wires
 * the layers.
 */
@VendurePlugin({
  // `requirePermission` applies `@TenantScoped()`, whose guard resolves through tenancy's exports; product changes
  // go out through the outbox in the write transaction (D2127); `RateLimitPlugin` serves the upload limiter (D2138).
  imports: [PluginCommonModule, TenancyPlugin, PlatformOutboxPlugin, RateLimitPlugin],
  entities: CATALOG_ENTITIES,
  configuration: configureCatalogCustomFields,
  providers: [
    ...PRODUCT_PROVIDERS,
    ProductWriteUseCases,
    ProductReadUseCases,
    ProductActions,
    TaxonomyActions,
    MediaActions,
    MediaThrottle,
    CatalogTranslations,
    CatalogProductQueries,
  ],
  // The read facade of later sessions (D2104) and the registrar team's order-manager check joins (D2114); other
  // plugins inject them from their infrastructure.
  exports: [CatalogProductQueries, ORDER_MANAGER_CHECK_REGISTRAR],
  adminApiExtensions: {
    schema: catalogAdminApiSchema,
    resolvers: [ProductsResolver, TaxonomyResolver, MediaResolver],
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
