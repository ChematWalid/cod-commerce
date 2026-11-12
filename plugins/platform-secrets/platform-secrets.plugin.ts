import { SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { adminApiSchema } from './api/schema';
import { TenantSecretsResolver } from './api/tenant-secrets.resolver';
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
  KEK_RING,
  SECRET_LOGGER,
  SECRET_PORTS,
  SECRET_REPOSITORY,
} from './application/tokens';
import { SECRETS_LOG_CONTEXT } from './domain/constants';
import type { EnvelopeCipherPort, KekRing } from './domain/ports/envelope-cipher.port';
import type { DataKeyRepositoryPort, SecretRepositoryPort } from './domain/ports/secret-repositories.port';
import { AesGcmEnvelope } from './infrastructure/aes-gcm-envelope';
import { TenantDataKeyEntity } from './infrastructure/tenant-data-key.entity';
import { TenantSecretEntity } from './infrastructure/tenant-secret.entity';
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
  imports: [PluginCommonModule, TenancyPlugin],
  entities: [TenantDataKeyEntity, TenantSecretEntity],
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
  ],
  adminApiExtensions: { schema: adminApiSchema, resolvers: [TenantSecretsResolver] },
  exports: [TenantSecretService, TenantSecretProviderRegistry],
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its statics carry the options `init` sets, as in the other platform plugins.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PlatformSecretsPlugin {
  static options: PlatformSecretsOptions | undefined;

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
