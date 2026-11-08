import { Logger, PluginCommonModule, type RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { Redis } from 'ioredis';
import { tenantBusinessPermission, tenantStorePermission } from './api/permissions';
import { TenantGuard } from './api/tenant.guard';
import { CreateStoreService } from './application/create-store.service';
import { ProvisionBusinessService } from './application/provision-business.service';
import type { TenancyPorts } from './application/tenancy-ports';
import {
  CHANNEL_PROVISIONER,
  ID_GENERATOR,
  PLATFORM_STORE,
  TENANCY_PORTS,
  TENANT_CONTEXT_RESOLVER,
  TRANSACTION,
} from './application/tokens';
import type { ChannelProvisionerPort } from './domain/ports/channel-provisioner.port';
import type { IdGeneratorPort } from './domain/ports/id-generator.port';
import type { PlatformStorePort } from './domain/ports/platform-store.port';
import type { TransactionPort } from './domain/ports/transaction.port';
import { BusinessOrderSequenceEntity } from './infrastructure/business-order-sequence.entity';
import { BusinessEntity } from './infrastructure/business.entity';
import { CustomDomainEntity } from './infrastructure/custom-domain.entity';
import { PlatformStoreLookup } from './infrastructure/platform-store-lookup';
import { StoreEntity } from './infrastructure/store.entity';
import { TenantContextResolver } from './infrastructure/tenant-context.resolver';
import { TenantRepositoryFactory } from './infrastructure/tenant-repository';
import { TenantTransaction } from './infrastructure/tenant-transaction';
import { ValkeySnowflakeGenerator } from './infrastructure/valkey-snowflake.generator';
import { VendureChannelProvisioner } from './infrastructure/vendure-channel-provisioner';
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
  config.authOptions.customPermissions.push(tenantBusinessPermission, tenantStorePermission);
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

/** Businesses and stores over Vendure's sellers and channels. This module only wires the layers. */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [BusinessEntity, StoreEntity, CustomDomainEntity, BusinessOrderSequenceEntity],
  providers: [
    { provide: CHANNEL_PROVISIONER, useClass: VendureChannelProvisioner },
    PlatformStoreLookup,
    { provide: PLATFORM_STORE, useExisting: PlatformStoreLookup },
    TenantContextResolver,
    { provide: TENANT_CONTEXT_RESOLVER, useExisting: TenantContextResolver },
    TenantGuard,
    TenantRepositoryFactory,
    TenantTransaction,
    { provide: TRANSACTION, useClass: VendureTransaction },
    { provide: ID_GENERATOR, useFactory: createIdGenerator },
    {
      provide: TENANCY_PORTS,
      useFactory: (
        channels: ChannelProvisionerPort,
        platform: PlatformStorePort,
        transaction: TransactionPort,
        ids: IdGeneratorPort,
      ): TenancyPorts => ({ channels, platform, transaction, ids, clock: systemClock }),
      inject: [CHANNEL_PROVISIONER, PLATFORM_STORE, TRANSACTION, ID_GENERATOR],
    },
    {
      provide: CreateStoreService,
      useFactory: (ports: TenancyPorts) => new CreateStoreService(ports),
      inject: [TENANCY_PORTS],
    },
    {
      provide: ProvisionBusinessService,
      useFactory: (ports: TenancyPorts, stores: CreateStoreService) => new ProvisionBusinessService(ports, stores),
      inject: [TENANCY_PORTS, CreateStoreService],
    },
  ],
  exports: [
    CreateStoreService,
    ProvisionBusinessService,
    TenantContextResolver,
    TENANT_CONTEXT_RESOLVER,
    TenantGuard,
    TenantRepositoryFactory,
    TenantTransaction,
  ],
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
