import { GeoPlugin } from '@cod/plugin-geo';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { DeliveryPricingTranslations } from './api/delivery-pricing-translations';
import { FeeGroupActions } from './api/fee-group-actions';
import { FeeGroupUseCases } from './api/fee-group-use-cases';
import { FeeGroupsController } from './api/fee-groups.controller';
import { FeeGroupsResolver } from './api/fee-groups.resolver';
import { RestI18nMiddleware } from './api/rest-i18n.middleware';
import { deliveryPricingAdminApiSchema } from './api/schema';
import { DefaultTableService } from './application/default-table.service';
import { DELIVERY_PRICING_ENTITIES } from './infrastructure/delivery-pricing-entities';
import { DELIVERY_PRICING_PROVIDERS } from './infrastructure/delivery-pricing.providers';

/** Every REST controller of the plugin. */
export const DELIVERY_PRICING_REST_CONTROLLERS = [FeeGroupsController];

/**
 * Per-store delivery fee groups ("pricing options", D3125): one row per wilaya with base and override prices, a
 * sparse commune layer checked against geo's town directory, and the seeded "Platform default prices" table (D3124).
 * Tenancy scopes the tables and resolves the guard; geo exports the town directory. This module only wires the layers.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, GeoPlugin],
  entities: DELIVERY_PRICING_ENTITIES,
  providers: [...DELIVERY_PRICING_PROVIDERS, FeeGroupUseCases, FeeGroupActions, DeliveryPricingTranslations],
  exports: [DefaultTableService],
  adminApiExtensions: { schema: deliveryPricingAdminApiSchema, resolvers: [FeeGroupsResolver] },
  controllers: DELIVERY_PRICING_REST_CONTROLLERS,
  compatibility: '^3.8.0',
})
export class DeliveryPricingPlugin implements NestModule {
  /** REST refusals are translated, like GraphQL ones. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RestI18nMiddleware).forRoutes(...DELIVERY_PRICING_REST_CONTROLLERS);
  }
}
