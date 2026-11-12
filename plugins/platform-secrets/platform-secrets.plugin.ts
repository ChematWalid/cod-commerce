import { PLATFORM_CLOCK, type PlatformClock, PlatformJobsPlugin, PlatformQueues } from '@cod/plugin-platform-jobs';
import { SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { Inject } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { adminApiSchema } from './api/schema';
import { TenantSecretsResolver } from './api/tenant-secrets.resolver';
import { type KekRotationPorts, KekRotationService } from './application/kek-rotation.service';
import { TenantSecretProviderRegistry } from './application/provider-registry';
import {
  type SecretIdSource,
  type SecretLogger,
  type SecretPorts,
  TenantSecretService,
} from './application/tenant-secret.service';
import {
  DATA_KEY_REPOSITORY,
  ENVELOPE_CIPHER,
  KEK_REWRAP_QUEUE,
  KEK_REWRAP_STORE,
  KEK_ROTATION_PORTS,
  KEK_RING,
  RETIRED_KEK_SCAN,
  SECRET_LOGGER,
  SECRET_PORTS,
  SECRET_REPOSITORY,
} from './application/tokens';
import { KEK_ROTATION_TASK_ID, SECRETS_LOG_CONTEXT } from './domain/constants';
import type { EnvelopeCipherPort, KekRing } from './domain/ports/envelope-cipher.port';
import type { KekRewrapQueuePort, KekRewrapStorePort, RetiredKekScanPort } from './domain/ports/kek-rotation.ports';
import type { DataKeyRepositoryPort, SecretRepositoryPort } from './domain/ports/secret-repositories.port';
import { AesGcmEnvelope } from './infrastructure/aes-gcm-envelope';
import { defineKekRewrapJob, PlatformKekRewrapQueue } from './infrastructure/kek-rewrap.job';
import { kekRotationTask } from './infrastructure/kek-rotation.task';
import { PostgresRetiredKekScan } from './infrastructure/retired-kek-scan';
import { TenantDataKeyEntity } from './infrastructure/tenant-data-key.entity';
import { TenantSecretEntity } from './infrastructure/tenant-secret.entity';
import { TypeOrmKekRewrapStore } from './infrastructure/typeorm-kek-rewrap.store';
import { TypeOrmDataKeyRepository, TypeOrmSecretRepository } from './infrastructure/typeorm-secret.repositories';

/** How the server configures {@link PlatformSecretsPlugin}: the key-encryption keys, parsed from the environment. */
export interface PlatformSecretsOptions {
  readonly kekRing: KekRing;
}

const secretLogger: SecretLogger = {
  warn: (message) => {
    Logger.warn(message, SECRETS_LOG_CONTEXT);
  },
};

/**
 * Envelope-encrypted tenant secrets (D114). Feature plugins register their providers with
 * `TenantSecretProviderRegistry.register` in `onModuleInit` and read values back with `TenantSecretService.reveal`;
 * merchants write them through the Admin API, which never returns a value.
 */
@VendurePlugin({
  // `requirePermission` applies `@TenantScoped()`, whose guard resolves here, through the plugin's exports.
  imports: [PluginCommonModule, TenancyPlugin, PlatformJobsPlugin],
  entities: [TenantDataKeyEntity, TenantSecretEntity],
  configuration: (config) => {
    config.schedulerOptions.tasks = [
      ...config.schedulerOptions.tasks.filter((task) => task.id !== KEK_ROTATION_TASK_ID),
      kekRotationTask,
    ];
    return config;
  },
  providers: [
    TenantSecretProviderRegistry,
    { provide: KEK_RING, useFactory: (): KekRing => PlatformSecretsPlugin.requireOptions().kekRing },
    { provide: ENVELOPE_CIPHER, useClass: AesGcmEnvelope },
    TypeOrmDataKeyRepository,
    { provide: DATA_KEY_REPOSITORY, useExisting: TypeOrmDataKeyRepository },
    TypeOrmSecretRepository,
    { provide: SECRET_REPOSITORY, useExisting: TypeOrmSecretRepository },
    { provide: SECRET_LOGGER, useValue: secretLogger },
    {
      provide: SECRET_PORTS,
      useFactory: (
        cipher: EnvelopeCipherPort,
        dataKeys: DataKeyRepositoryPort,
        secrets: SecretRepositoryPort,
        logger: SecretLogger,
      ): SecretPorts => ({ cipher, dataKeys, secrets, logger }),
      inject: [ENVELOPE_CIPHER, DATA_KEY_REPOSITORY, SECRET_REPOSITORY, SECRET_LOGGER],
    },
    {
      provide: TenantSecretService,
      useFactory: (providers: TenantSecretProviderRegistry, ring: KekRing, ids: SecretIdSource, ports: SecretPorts) =>
        new TenantSecretService({ ...ports, providers, ring, ids }),
      inject: [TenantSecretProviderRegistry, KEK_RING, SNOWFLAKE_ID_GENERATOR, SECRET_PORTS],
    },
    PostgresRetiredKekScan,
    { provide: RETIRED_KEK_SCAN, useExisting: PostgresRetiredKekScan },
    PlatformKekRewrapQueue,
    { provide: KEK_REWRAP_QUEUE, useExisting: PlatformKekRewrapQueue },
    TypeOrmKekRewrapStore,
    { provide: KEK_REWRAP_STORE, useExisting: TypeOrmKekRewrapStore },
    {
      provide: KEK_ROTATION_PORTS,
      useFactory: (
        scan: RetiredKekScanPort,
        queue: KekRewrapQueuePort,
        store: KekRewrapStorePort,
        logger: SecretLogger,
      ): KekRotationPorts => ({ scan, queue, store, logger }),
      inject: [RETIRED_KEK_SCAN, KEK_REWRAP_QUEUE, KEK_REWRAP_STORE, SECRET_LOGGER],
    },
    {
      provide: KekRotationService,
      useFactory: (ring: KekRing, cipher: EnvelopeCipherPort, ports: KekRotationPorts, clock: PlatformClock) =>
        new KekRotationService({ ...ports, ring, cipher, clock }),
      inject: [KEK_RING, ENVELOPE_CIPHER, KEK_ROTATION_PORTS, PLATFORM_CLOCK],
    },
  ],
  adminApiExtensions: { schema: adminApiSchema, resolvers: [TenantSecretsResolver] },
  exports: [TenantSecretService, TenantSecretProviderRegistry, KekRotationService],
  compatibility: '^3.8.0',
})
export class PlatformSecretsPlugin {
  static options: PlatformSecretsOptions | undefined;

  constructor(
    @Inject(PlatformQueues) private readonly queues: PlatformQueues,
    @Inject(KekRotationService) private readonly rotation: KekRotationService,
    @Inject(KEK_RING) private readonly ring: KekRing,
  ) {}

  /** Creates the maintenance queue whose jobs re-wrap data keys (Task 12). */
  onModuleInit(): void {
    defineKekRewrapJob(this.queues, this.rotation, this.ring);
  }

  /** Registers the plugin with the key ring the server parsed from `TENANT_SECRET_KEKS`. */
  static init(options: PlatformSecretsOptions): typeof PlatformSecretsPlugin {
    PlatformSecretsPlugin.options = options;
    return PlatformSecretsPlugin;
  }

  /** The options `init` set; the secrets cannot work without keys, so a missing `init` stops the boot. */
  static requireOptions(): PlatformSecretsOptions {
    if (PlatformSecretsPlugin.options === undefined) {
      throw new Error('PlatformSecretsPlugin needs a key ring: use PlatformSecretsPlugin.init(...)');
    }
    return PlatformSecretsPlugin.options;
  }
}
