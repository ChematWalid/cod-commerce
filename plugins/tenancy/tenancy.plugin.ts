import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { Logger, PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { Redis } from 'ioredis';
import { platformStaffPermission, tenantBusinessPermission, tenantStorePermission } from './api/permissions';
import { TenantGuard } from './api/tenant.guard';
import { BusinessResolver } from './api/business.resolver';
import { adminApiSchema } from './api/schema';
import { StoreFieldsResolver, StoreMutationResolver, StoreQueryResolver } from './api/store.resolver';
import { StoreResolveController } from './api/store-resolve.controller';
import { SubdomainController } from './api/subdomain.controller';
import { ArchiveStoreService } from './application/archive-store.service';
import { ChangeSubdomainService } from './application/change-subdomain.service';
import { CheckSubdomainService } from './application/check-subdomain.service';
import { CreateStoreService } from './application/create-store.service';
import { GetBusinessService } from './application/get-business.service';
import { GetStoresService } from './application/get-stores.service';
import { MemberAccountService } from './application/member-account.service';
import { ProvisionBusinessService } from './application/provision-business.service';
import type { StoreAdminPorts } from './application/store-admin-ports';
import type { TenancyPorts } from './application/tenancy-ports';
import { type TenantLifecycleRegistrar, TenantLifecycleRegistry } from './application/tenant-lifecycle.registry';
import { UpdateBusinessService } from './application/update-business.service';
import { UpdateStoreService } from './application/update-store.service';
import {
  ASSET_ACCESS,
  CHANNEL_PROVISIONER,
  ID_GENERATOR,
  MEMBER_ACCOUNTS,
  PLATFORM_DOMAIN,
  PLATFORM_STORE,
  STORE_ADMIN_PORTS,
  STORE_HOST_INVALIDATOR,
  TENANCY_PORTS,
  TENANT_LIFECYCLE,
  TENANT_LIFECYCLE_REGISTRAR,
  TENANT_CONTEXT_RESOLVER,
  TENANT_STORES,
  TRANSACTION,
} from './application/tokens';
import type { AssetAccessPort } from './domain/ports/asset-access.port';
import { BusinessStoreDirectory } from './domain/ports/business-store-directory.port';
import type { ChannelProvisionerPort } from './domain/ports/channel-provisioner.port';
import type { IdGeneratorPort } from './domain/ports/id-generator.port';
import type { MemberAccountPort } from './domain/ports/member-account.port';
import type { PlatformStorePort } from './domain/ports/platform-store.port';
import type { TenantLifecycleHook } from './domain/ports/tenant-lifecycle.port';
import type { StoreHostInvalidatorPort } from './domain/ports/store-host-invalidator.port';
import type { TenantStoresPort } from './domain/ports/tenant-stores.port';
import type { TransactionPort } from './domain/ports/transaction.port';
import { BusinessOrderSequenceEntity } from './infrastructure/business-order-sequence.entity';
import { BusinessEntity } from './infrastructure/business.entity';
import { CustomDomainEntity } from './infrastructure/custom-domain.entity';
import { PlatformStoreLookup } from './infrastructure/platform-store-lookup';
import { hostResolutionProviders } from './infrastructure/host-resolution.providers';
import { StoreEntity } from './infrastructure/store.entity';
import { TenantContextResolver } from './infrastructure/tenant-context.resolver';
import { OrderNumberService } from './infrastructure/order-number.service';
import { TenantRepositoryFactory } from './infrastructure/tenant-repository';
import { TenantStoresAdapter } from './infrastructure/tenant-stores.adapter';
import { TenantTransaction } from './infrastructure/tenant-transaction';
import { ValkeySnowflakeGenerator } from './infrastructure/valkey-snowflake.generator';
import { SuperadminContextFactory } from './infrastructure/superadmin-context.factory';
import { VendureAssetAccess } from './infrastructure/vendure-asset-access';
import { VendureChannelProvisioner } from './infrastructure/vendure-channel-provisioner';
import { VendureMemberAccounts } from './infrastructure/vendure-member-accounts';
import { VendureTransaction } from './infrastructure/vendure-transaction';

/** How {@link TenancyPlugin} is configured. */
export interface TenancyPluginOptions {
  readonly redisUrl: string;
  /** The domain stores are subdomains of, e.g. `example.com`. */
  readonly platformDomain: string;
  /** Skips the Valkey lease and uses this worker id: tests and scripts only (ADR 0003's reserved range). */
  readonly snowflakeWorkerId?: number;
}

/** The longest a business id gets: 19 digits, with room for one more (D2). */
const BUSINESS_ID_FIELD_LENGTH = 20;

const LOG_CONTEXT = 'TenancyPlugin';

const systemClock = (): Date => new Date();

function requireOptions(): TenancyPluginOptions {
  const { options } = TenancyPlugin;
  if (options === undefined) {
    throw new Error('TenancyPlugin is registered without options: use TenancyPlugin.init(...)');
  }
  return options;
}

function createIdGenerator(): ValkeySnowflakeGenerator {
  const { redisUrl, snowflakeWorkerId } = requireOptions();
  // `lazyConnect`: a pinned worker id never touches Valkey. One retry keeps a Valkey outage from stalling boot.
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  redis.on('error', (error: Error) => {
    Logger.warn(`Valkey: ${error.message}`, LOG_CONTEXT);
  });
  return new ValkeySnowflakeGenerator(redis, { pinnedWorkerId: snowflakeWorkerId });
}

function configure(config: RuntimeVendureConfig): RuntimeVendureConfig {
  config.authOptions.customPermissions.push(tenantBusinessPermission, tenantStorePermission, platformStaffPermission);
  config.customFields.Administrator.push({
    name: 'businessId',
    type: 'string',
    length: BUSINESS_ID_FIELD_LENGTH,
    index: true,
    nullable: true,
    internal: true,
  });
  return config;
}

/** The use cases built on {@link StoreAdminPorts}. */
const STORE_USE_CASES = [
  GetBusinessService,
  UpdateBusinessService,
  GetStoresService,
  UpdateStoreService,
  ArchiveStoreService,
  ChangeSubdomainService,
  CheckSubdomainService,
].map((useCase) => ({
  provide: useCase,
  useFactory: (ports: StoreAdminPorts) => new useCase(ports),
  inject: [STORE_ADMIN_PORTS],
}));

/** Businesses and stores over Vendure's sellers and channels. This module only wires the layers. */
@VendurePlugin({
  imports: [PluginCommonModule, RateLimitPlugin],
  entities: [BusinessEntity, StoreEntity, CustomDomainEntity, BusinessOrderSequenceEntity],
  providers: [
    { provide: CHANNEL_PROVISIONER, useClass: VendureChannelProvisioner },
    { provide: ASSET_ACCESS, useClass: VendureAssetAccess },
    PlatformStoreLookup,
    { provide: PLATFORM_STORE, useExisting: PlatformStoreLookup },
    { provide: BusinessStoreDirectory, useExisting: PlatformStoreLookup },
    SuperadminContextFactory,
    { provide: TENANT_LIFECYCLE, useClass: TenantLifecycleRegistry },
    {
      provide: TENANT_LIFECYCLE_REGISTRAR,
      useFactory: (registry: TenantLifecycleRegistry): TenantLifecycleRegistrar => ({
        register: (hook) => {
          registry.register(hook);
        },
      }),
      inject: [TENANT_LIFECYCLE],
    },
    { provide: PLATFORM_DOMAIN, useFactory: () => requireOptions().platformDomain },
    TenantContextResolver,
    { provide: TENANT_CONTEXT_RESOLVER, useExisting: TenantContextResolver },
    TenantGuard,
    TenantRepositoryFactory,
    OrderNumberService,
    TenantTransaction,
    { provide: TRANSACTION, useClass: VendureTransaction },
    { provide: ID_GENERATOR, useFactory: createIdGenerator },
    {
      provide: TENANCY_PORTS,
      useFactory: (
        ...[channels, assets, platform, transaction, ids, lifecycle]: [
          ChannelProvisionerPort,
          AssetAccessPort,
          PlatformStorePort,
          TransactionPort,
          IdGeneratorPort,
          TenantLifecycleHook,
        ]
      ): TenancyPorts => ({ channels, assets, platform, transaction, ids, lifecycle, clock: systemClock }),
      inject: [CHANNEL_PROVISIONER, ASSET_ACCESS, PLATFORM_STORE, TRANSACTION, ID_GENERATOR, TENANT_LIFECYCLE],
    },
    {
      provide: CreateStoreService,
      useFactory: (ports: TenancyPorts) => new CreateStoreService(ports),
      inject: [TENANCY_PORTS],
    },
    { provide: TENANT_STORES, useClass: TenantStoresAdapter },
    ...hostResolutionProviders(() => requireOptions()),
    {
      provide: STORE_ADMIN_PORTS,
      useFactory: (
        ports: TenancyPorts,
        stores: TenantStoresPort,
        hosts: StoreHostInvalidatorPort,
      ): StoreAdminPorts => ({ ...ports, stores, hosts }),
      inject: [TENANCY_PORTS, TENANT_STORES, STORE_HOST_INVALIDATOR],
    },
    ...STORE_USE_CASES,
    {
      provide: ProvisionBusinessService,
      useFactory: (ports: TenancyPorts, stores: CreateStoreService) => new ProvisionBusinessService(ports, stores),
      inject: [TENANCY_PORTS, CreateStoreService],
    },
    { provide: MEMBER_ACCOUNTS, useClass: VendureMemberAccounts },
    {
      provide: MemberAccountService,
      useFactory: (accounts: MemberAccountPort, ports: TenancyPorts) =>
        new MemberAccountService({ accounts, platform: ports.platform, transaction: ports.transaction }),
      inject: [MEMBER_ACCOUNTS, TENANCY_PORTS],
    },
  ],
  exports: [
    BusinessStoreDirectory,
    CreateStoreService,
    ID_GENERATOR,
    MemberAccountService,
    OrderNumberService,
    ProvisionBusinessService,
    SuperadminContextFactory,
    TENANT_LIFECYCLE_REGISTRAR,
    TenantContextResolver,
    TENANT_CONTEXT_RESOLVER,
    TenantGuard,
    TenantRepositoryFactory,
    TenantTransaction,
  ],
  adminApiExtensions: {
    schema: adminApiSchema,
    resolvers: [BusinessResolver, StoreQueryResolver, StoreMutationResolver, StoreFieldsResolver],
  },
  controllers: [SubdomainController, StoreResolveController],
  configuration: configure,
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TenancyPlugin {
  static options: TenancyPluginOptions | undefined;

  /** Registers the plugin with its options. */
  static init(options: TenancyPluginOptions): typeof TenancyPlugin {
    TenancyPlugin.options = options;
    return TenancyPlugin;
  }
}
