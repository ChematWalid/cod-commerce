import { PLATFORM_CLOCK, type PlatformClock, PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { adminApiSchema } from './api/schema';
import { FlagsResolver } from './api/flags.resolver';
import { FeatureFlags } from './application/feature-flags.service';
import { FlagAdminService } from './application/flag-admin.service';
import { FlagSeedService } from './application/flag-seed.service';
import type { FeatureFlagsPorts, FlagAdminPorts, FlagLogger, FlagSubjectPort } from './application/ports';
import {
  FLAG_ADMIN_PORTS,
  FLAG_CACHE,
  FLAG_CLOCK,
  FLAG_LOGGER,
  FLAG_PORTS,
  FLAG_STORE,
  FLAG_SUBJECTS,
  PLAN_OF_BUSINESS,
  SCOPE_DIRECTORY,
} from './application/tokens';
import { FLAGS_LOG_CONTEXT } from './domain/constants';
import type { FlagCachePort } from './domain/ports/flag-cache.port';
import type { FlagStorePort } from './domain/ports/flag-store.port';
import type { PlanOfBusinessPort } from './domain/ports/plan-of-business.port';
import type { ScopeDirectoryPort } from './domain/ports/scope-directory.port';
import { FeatureFlagEntity } from './infrastructure/feature-flag.entity';
import { FeatureFlagOverrideEntity } from './infrastructure/feature-flag-override.entity';
import { FlagInvalidationSubscriber } from './infrastructure/flag-invalidation.subscriber';
import { NoPlanAdapter } from './infrastructure/no-plan.adapter';
import { TenancyScopeDirectory } from './infrastructure/tenancy-scope-directory';
import { TenantFlagSubjects } from './infrastructure/tenant-flag-subjects';
import { FLAG_SUBSCRIBER_CACHE } from './infrastructure/tokens';
import { TypeOrmFlagStore } from './infrastructure/typeorm-flag-store';
import { ValkeyFlagCache } from './infrastructure/valkey-flag-cache';

/** How the server configures {@link PlatformFlagsPlugin}: the Valkey address (`REDIS_URL`) and the key prefix (`APP_ENV`). */
export interface PlatformFlagsOptions {
  readonly redisUrl: string;
  readonly appEnv: string;
}

const flagLogger: FlagLogger = {
  info: (message) => {
    Logger.info(message, FLAGS_LOG_CONTEXT);
  },
  warn: (message) => {
    Logger.warn(message, FLAGS_LOG_CONTEXT);
  },
  error: (message) => {
    Logger.error(message, FLAGS_LOG_CONTEXT);
  },
};

function requireOptions(): PlatformFlagsOptions {
  const { options } = PlatformFlagsPlugin;
  if (options === undefined) {
    throw new Error('PlatformFlagsPlugin is registered without options: use PlatformFlagsPlugin.init(...)');
  }
  return options;
}

/**
 * Operational flags and kill switches (D116). Other plugins ask `FeatureFlags.isEnabled(ctx, key)` or
 * `isEnabledFor(subject, key)`; platform staff manage the flags through the Admin API; `FlagSeedService.converge()`
 * inserts the missing seeds on every migrate. The snapshot of all flags is cached 30 s in the process, 24 h in Valkey.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, PlatformJobsPlugin],
  entities: [FeatureFlagEntity, FeatureFlagOverrideEntity],
  providers: [
    { provide: FLAG_LOGGER, useValue: flagLogger },
    { provide: FLAG_CLOCK, useExisting: PLATFORM_CLOCK },
    TypeOrmFlagStore,
    { provide: FLAG_STORE, useExisting: TypeOrmFlagStore },
    {
      provide: ValkeyFlagCache,
      useFactory: (clock: PlatformClock, logger: FlagLogger) =>
        new ValkeyFlagCache({ ...requireOptions(), clock, logger }),
      inject: [PLATFORM_CLOCK, FLAG_LOGGER],
    },
    { provide: FLAG_CACHE, useExisting: ValkeyFlagCache },
    { provide: FLAG_SUBSCRIBER_CACHE, useExisting: ValkeyFlagCache },
    NoPlanAdapter,
    { provide: PLAN_OF_BUSINESS, useExisting: NoPlanAdapter },
    TenancyScopeDirectory,
    { provide: SCOPE_DIRECTORY, useExisting: TenancyScopeDirectory },
    TenantFlagSubjects,
    { provide: FLAG_SUBJECTS, useExisting: TenantFlagSubjects },
    {
      provide: FLAG_PORTS,
      // eslint-disable-next-line max-params -- wiring: one argument per port the object holds
      useFactory: (
        store: FlagStorePort,
        cache: FlagCachePort,
        plans: PlanOfBusinessPort,
        subjects: FlagSubjectPort,
        clock: PlatformClock,
        logger: FlagLogger,
      ): FeatureFlagsPorts => ({ store, cache, plans, subjects, clock, logger }),
      inject: [FLAG_STORE, FLAG_CACHE, PLAN_OF_BUSINESS, FLAG_SUBJECTS, FLAG_CLOCK, FLAG_LOGGER],
    },
    {
      provide: FLAG_ADMIN_PORTS,
      useFactory: (
        store: FlagStorePort,
        cache: FlagCachePort,
        directory: ScopeDirectoryPort,
        logger: FlagLogger,
      ): FlagAdminPorts => ({ store, cache, directory, logger }),
      inject: [FLAG_STORE, FLAG_CACHE, SCOPE_DIRECTORY, FLAG_LOGGER],
    },
    { provide: FeatureFlags, useFactory: (ports: FeatureFlagsPorts) => new FeatureFlags(ports), inject: [FLAG_PORTS] },
    {
      provide: FlagAdminService,
      useFactory: (ports: FlagAdminPorts, flags: FeatureFlags) => new FlagAdminService(ports, flags),
      inject: [FLAG_ADMIN_PORTS, FeatureFlags],
    },
    {
      provide: FlagSeedService,
      useFactory: (store: FlagStorePort, logger: FlagLogger) => new FlagSeedService(store, logger),
      inject: [FLAG_STORE, FLAG_LOGGER],
    },
    FlagInvalidationSubscriber,
  ],
  adminApiExtensions: { schema: adminApiSchema, resolvers: [FlagsResolver] },
  exports: [FeatureFlags, FlagAdminService, FlagSeedService],
  compatibility: '^3.8.0',
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- a Vendure plugin is a decorated class
export class PlatformFlagsPlugin {
  static options: PlatformFlagsOptions | undefined;

  /** Registers the plugin with the Valkey address and the environment name the server validated. */
  static init(options: PlatformFlagsOptions): typeof PlatformFlagsPlugin {
    PlatformFlagsPlugin.options = options;
    return PlatformFlagsPlugin;
  }
}
