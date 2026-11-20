import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { CollectionReadUseCases, CollectionsActions, CollectionUseCases } from './api/collections-actions';
import { CollectionsController } from './api/collections.controller';
import { CollectionsResolver } from './api/collections.resolver';
import { CollectionsTranslations } from './api/collections-translations';
import { MembershipActions, MembershipUseCases } from './api/membership-actions';
import { MembershipResolver } from './api/membership.resolver';
import { CollectionsThrottle } from './api/preview-throttle';
import { RestI18nMiddleware } from './api/rest-i18n.middleware';
import { RulesActions, RulesUseCases } from './api/rules-actions';
import { RulesController } from './api/rules.controller';
import { RulesResolver } from './api/rules.resolver';
import { collectionsRulesAdminApiSchema } from './api/schema';
import { COLLECTIONS_EXPORTS, COLLECTIONS_PROVIDERS } from './infrastructure/collections.providers';
import { COLLECTIONS_ENTITIES } from './infrastructure/collections-entities';
import { COLLECTIONS_RECONCILE_TASK_ID, collectionsReconcileTask } from './infrastructure/reconcile.task';

/** Every REST controller; literal routes are declared before `:id` (D2315), so the rule builder's come first. */
export const COLLECTIONS_REST_CONTROLLERS = [RulesController, CollectionsController];

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
  entities: COLLECTIONS_ENTITIES,
  configuration: (config) => {
    config.schedulerOptions.tasks = [
      ...config.schedulerOptions.tasks.filter((task) => task.id !== COLLECTIONS_RECONCILE_TASK_ID),
      collectionsReconcileTask,
    ];
    return config;
  },
  providers: [
    ...COLLECTIONS_PROVIDERS,
    CollectionReadUseCases,
    CollectionUseCases,
    CollectionsActions,
    MembershipUseCases,
    MembershipActions,
    CollectionsThrottle,
    RulesUseCases,
    RulesActions,
    CollectionsTranslations,
  ],
  adminApiExtensions: {
    schema: collectionsRulesAdminApiSchema,
    resolvers: [CollectionsResolver, MembershipResolver, RulesResolver],
  },
  controllers: COLLECTIONS_REST_CONTROLLERS,
  exports: COLLECTIONS_EXPORTS,
  dashboard: './dashboard/index.tsx',
  compatibility: '^3.8.0',
})
export class CollectionsRulesPlugin implements NestModule {
  /** REST refusals are translated, like GraphQL ones. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RestI18nMiddleware).forRoutes(...COLLECTIONS_REST_CONTROLLERS);
  }
}
