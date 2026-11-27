import { CatalogPlugin } from '@cod/plugin-catalog';
import { GeoPlugin } from '@cod/plugin-geo';
import { OffersPlugin } from '@cod/plugin-offers';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { DeliveryPricingTranslations } from './api/delivery-pricing-translations';
import { FeeGroupActions } from './api/fee-group-actions';
import { FeeGroupCsvActions } from './api/fee-group-csv-actions';
import { FeeGroupCsvController } from './api/fee-group-csv.controller';
import { FeeGroupCsvResolver } from './api/fee-group-csv.resolver';
import { FeeGroupBulkUseCases, FeeGroupCsvUseCases, FeeGroupUseCases } from './api/fee-group-use-cases';
import { FeeGroupsController } from './api/fee-groups.controller';
import { FeeGroupsResolver } from './api/fee-groups.resolver';
import { RestI18nMiddleware } from './api/rest-i18n.middleware';
import { deliveryPricingAdminApiSchema } from './api/schema';
import { DefaultTableService } from './application/default-table.service';
import { DeliveryDefaultsConvergeService } from './application/delivery-defaults-converge.service';
import { ShippingQuoteService } from './application/shipping-quote.service';
import { DELIVERY_PRICING_ENTITIES } from './infrastructure/delivery-pricing-entities';
import { DELIVERY_PRICING_PROVIDERS } from './infrastructure/delivery-pricing.providers';

/** Every REST controller of the plugin. */
export const DELIVERY_PRICING_REST_CONTROLLERS = [FeeGroupsController, FeeGroupCsvController];

/**
 * Per-store delivery fee groups ("pricing options", D3125): one row per wilaya with base and override prices, a
 * sparse commune layer checked against geo's town directory, and the seeded "Platform default prices" table (D3124).
 * Tenancy scopes the tables and resolves the guard; geo exports the town directory, the catalog the product weights,
 * and the offers the shipping quote seam its `ShippingQuoteService` answers on. This module only wires the layers.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, GeoPlugin, CatalogPlugin, OffersPlugin],
  entities: DELIVERY_PRICING_ENTITIES,
  providers: [
    ...DELIVERY_PRICING_PROVIDERS,
    FeeGroupUseCases,
    FeeGroupBulkUseCases,
    FeeGroupCsvUseCases,
    FeeGroupActions,
    FeeGroupCsvActions,
    DeliveryPricingTranslations,
  ],
  exports: [DefaultTableService, DeliveryDefaultsConvergeService, ShippingQuoteService],
  adminApiExtensions: { schema: deliveryPricingAdminApiSchema, resolvers: [FeeGroupsResolver, FeeGroupCsvResolver] },
  controllers: DELIVERY_PRICING_REST_CONTROLLERS,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
export class DeliveryPricingPlugin implements NestModule {
  /** REST refusals are translated, like GraphQL ones. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RestI18nMiddleware).forRoutes(...DELIVERY_PRICING_REST_CONTROLLERS);
  }
}
