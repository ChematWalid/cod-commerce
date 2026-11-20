import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { QuoteKeyRing } from '@cod/shared/quote-keys';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { OfferActions } from './api/offer-actions';
import { OfferReadController } from './api/offer-read.controller';
import { OfferReadUseCases, OfferWriteUseCases } from './api/offer-use-cases';
import { OffersController } from './api/offers.controller';
import { OffersResolver } from './api/offers.resolver';
import { OffersTranslations } from './api/offers-translations';
import { RestI18nMiddleware } from './api/rest-i18n.middleware';
import { offersAdminApiSchema } from './api/schema';
import { QUOTE_KEY_RING } from './application/tokens';
import { OFFERS_ENTITIES } from './infrastructure/offers-entities';
import { OFFERS_PROVIDERS, OFFERS_REGISTRARS, OFFERS_USE_CASES } from './infrastructure/offers.providers';

/** How the server configures {@link OffersPlugin}. */
export interface OffersPluginOptions {
  /** The HMAC keys of the signed quotes, built from `QUOTE_HMAC_KEYS` and its active kid (D2422). */
  readonly quoteKeys: QuoteKeyRing;
}

/** Every REST controller; the read controller first, its `app-types` and `preview` routes before `:id` (D2518). */
export const OFFERS_REST_CONTROLLERS = [OfferReadController, OffersController];

/**
 * The pricing and offer engine of a store (ADR 0004, D2400): offers, discount codes and signed quotes. It imports
 * tenancy, whose guard scopes every call, the catalog, whose variants it prices, and the platform outbox, which carries
 * its `offer.applied` events (D2509). Its Admin API and REST routes (D2517-D2519) are guarded by `requirePermission`,
 * whose `@TenantScoped()` guard resolves through tenancy's exports. This module only wires the layers.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, CatalogPlugin, PlatformOutboxPlugin],
  entities: OFFERS_ENTITIES,
  providers: [
    { provide: QUOTE_KEY_RING, useFactory: (): QuoteKeyRing => OffersPlugin.requireOptions().quoteKeys },
    ...OFFERS_PROVIDERS,
    OfferWriteUseCases,
    OfferReadUseCases,
    OfferActions,
    OffersTranslations,
  ],
  exports: [...OFFERS_USE_CASES, ...OFFERS_REGISTRARS],
  adminApiExtensions: { schema: offersAdminApiSchema, resolvers: [OffersResolver] },
  controllers: OFFERS_REST_CONTROLLERS,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
export class OffersPlugin implements NestModule {
  static options: OffersPluginOptions | undefined;

  /** Registers the plugin with its options. */
  static init(options: OffersPluginOptions): typeof OffersPlugin {
    OffersPlugin.options = options;
    return OffersPlugin;
  }

  /** REST refusals are translated, like GraphQL ones (D2520). */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RestI18nMiddleware).forRoutes(...OFFERS_REST_CONTROLLERS);
  }

  /** The options `init` set; a missing `init` stops the boot. */
  static requireOptions(): OffersPluginOptions {
    if (OffersPlugin.options === undefined) {
      throw new Error('OffersPlugin needs its options: use OffersPlugin.init(...)');
    }
    return OffersPlugin.options;
  }
}
