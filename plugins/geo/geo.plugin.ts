import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { GeoTranslations } from './api/geo-translations';
import { ProvincesController } from './api/provinces.controller';
import { GeoRestI18nMiddleware } from './api/rest-i18n.middleware';
import { StoreProvincesController } from './api/store-provinces.controller';
import { GeoSeedService } from './application/geo-seed.service';
import { TOWN_AVAILABILITY_REGISTRAR, TOWN_DIRECTORY } from './application/tokens';
import { GEO_ENTITIES } from './infrastructure/geo-entities';
import { GEO_PROVIDERS } from './infrastructure/geo.providers';

/** The public reference routes, then the signed per-store ones (D3117, D3106). */
export const GEO_REST_CONTROLLERS = [ProvincesController, StoreProvincesController];

/**
 * Algeria's geo reference data: the wilayas and communes of law 26-06 (D3123), global tables that are not tenant
 * data (D3103). `GeoSeedService.converge()` upserts the seed on every migrate (D3116); the provinces routes read it.
 * Tenancy finds the stores of the signed route and the rate limiter guards the public one. This module also wires the
 * town availability seam, on whose registrar token delivery pricing registers, and the town directory it reads.
 */
@VendurePlugin({
  imports: [PluginCommonModule, RateLimitPlugin, TenancyPlugin],
  entities: GEO_ENTITIES,
  providers: [...GEO_PROVIDERS, GeoTranslations],
  exports: [TOWN_AVAILABILITY_REGISTRAR, TOWN_DIRECTORY, GeoSeedService],
  controllers: GEO_REST_CONTROLLERS,
  compatibility: '^3.8.0',
})
export class GeoPlugin implements NestModule {
  /** REST refusals are translated, like the offers' (D2520). */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(GeoRestI18nMiddleware).forRoutes(...GEO_REST_CONTROLLERS);
  }
}
