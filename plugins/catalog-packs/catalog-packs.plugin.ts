import { CatalogPlugin } from '@cod/plugin-catalog';
import { OffersPlugin } from '@cod/plugin-offers';
import { OutboxConsumerRegistry, PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { Inject, type MiddlewareConsumer, type NestModule, type OnModuleInit } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PackActions } from './api/pack-actions';
import { PackThrottle } from './api/pack-throttle';
import { PackUseCases } from './api/pack-use-cases';
import { PacksController } from './api/packs.controller';
import { PacksResolver } from './api/packs.resolver';
import { PacksTranslations } from './api/packs-translations';
import { RestI18nMiddleware } from './api/rest-i18n.middleware';
import { packsAdminApiSchema } from './api/schema';
import { CATALOG_PACKS_ENTITIES } from './infrastructure/pack-entities';
import { PackRecomputeConsumer } from './infrastructure/pack-recompute.consumer';
import { PackUnitPriceResolver } from './infrastructure/pack-unit-price.resolver';
import { PACK_PROVIDERS } from './infrastructure/providers';

/** Every REST controller of the plugin. */
export const CATALOG_PACKS_REST_CONTROLLERS = [PacksController];

/**
 * Pack (bundle) products of a store (D2200, D2202): the components, pricing, discount, variant and weight modes of a
 * catalog product of type `pack`, its computed price and weight written through catalog's explicit-scope facade
 * (D2201, D2203), the `catalog-packs-recompute` outbox consumer, the pack `UnitPriceResolver` registered with the offers (D2204,
 * D2276), and the pack block of catalog's product editor (`dashboard/`). This module only wires the layers.
 */
@VendurePlugin({
  // Catalog exports the facade the adapters write through; the outbox carries `product.changed` to the consumer;
  // `requirePermission` resolves through tenancy; the rate limiter serves the preview budget (D2217); the offers
  // export the unit price registrar the pack resolver registers with (D2276).
  imports: [PluginCommonModule, TenancyPlugin, PlatformOutboxPlugin, RateLimitPlugin, CatalogPlugin, OffersPlugin],
  entities: CATALOG_PACKS_ENTITIES,
  providers: [...PACK_PROVIDERS, PackUseCases, PackActions, PackThrottle, PacksTranslations],
  exports: [PackUnitPriceResolver],
  adminApiExtensions: { schema: packsAdminApiSchema, resolvers: [PacksResolver] },
  controllers: CATALOG_PACKS_REST_CONTROLLERS,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
export class CatalogPacksPlugin implements NestModule, OnModuleInit {
  constructor(
    @Inject(OutboxConsumerRegistry) private readonly consumers: OutboxConsumerRegistry,
    @Inject(PackRecomputeConsumer) private readonly recompute: PackRecomputeConsumer,
  ) {}

  /** Registers the recompute consumer before the outbox registry closes at bootstrap (D2203). */
  onModuleInit(): void {
    this.consumers.register(this.recompute);
  }

  /** REST refusals are translated, like GraphQL ones. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RestI18nMiddleware).forRoutes(...CATALOG_PACKS_REST_CONTROLLERS);
  }
}
