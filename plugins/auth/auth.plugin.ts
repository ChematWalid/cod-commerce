import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, type RuntimeVendureConfig, TransactionalConnection, VendurePlugin } from '@vendure/core';
import { AccountTokenService } from './application/account-token.service';
import { ACCOUNT_TOKEN_REPOSITORY, SECRET_HASHER } from './application/tokens';
import { ADMINISTRATOR_PHONE_MAX_LENGTH, EMAIL_LOCALE_LENGTH } from './domain/constants';
import type { AccountTokenRepositoryPort } from './domain/ports/account-token-repository.port';
import type { SecretHasherPort } from './domain/ports/secret-hasher.port';
import { accountTokenPurgeTask } from './infrastructure/account-token-purge.task';
import { AccountTokenEntity } from './infrastructure/account-token.entity';
import { HmacSecretHasher } from './infrastructure/hmac-secret-hasher';
import { TypeOrmAccountTokenRepository } from './infrastructure/typeorm-account-token.repository';

/** How {@link AuthPlugin} is configured. */
export interface AuthPluginOptions {
  /** `AUTH_TOKEN_SECRET`: the HMAC key of account tokens and codes. Rotating it voids the open ones (D25). */
  readonly tokenSecret: string;
}

const systemClock = { now: (): Date => new Date() };

function requireOptions(): AuthPluginOptions {
  const { options } = AuthPlugin;
  if (options === undefined) {
    throw new Error('AuthPlugin is registered without options: use AuthPlugin.init(...)');
  }
  return options;
}

/** `internal`: stock Admin inputs cannot write them and the API does not expose them (D23). */
function configure(config: RuntimeVendureConfig): RuntimeVendureConfig {
  config.customFields.Administrator.push(
    { name: 'emailVerifiedAt', type: 'datetime', nullable: true, internal: true },
    { name: 'phone', type: 'string', length: ADMINISTRATOR_PHONE_MAX_LENGTH, nullable: true, internal: true },
    {
      name: 'emailLocale',
      type: 'string',
      length: EMAIL_LOCALE_LENGTH,
      options: [{ value: 'ar' }, { value: 'en' }],
      defaultValue: 'ar',
      nullable: false,
      internal: true,
    },
  );
  config.schedulerOptions.tasks.push(accountTokenPurgeTask);
  return config;
}

/** Merchant accounts: this module only wires the layers. */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin],
  entities: [AccountTokenEntity],
  providers: [
    {
      provide: ACCOUNT_TOKEN_REPOSITORY,
      useFactory: (connection: TransactionalConnection) => new TypeOrmAccountTokenRepository(connection),
      inject: [TransactionalConnection],
    },
    { provide: SECRET_HASHER, useFactory: () => new HmacSecretHasher(requireOptions().tokenSecret) },
    {
      provide: AccountTokenService,
      useFactory: (tokens: AccountTokenRepositoryPort, hasher: SecretHasherPort, ids: SnowflakeIdGeneratorPort) =>
        new AccountTokenService(tokens, hasher, ids, systemClock),
      inject: [ACCOUNT_TOKEN_REPOSITORY, SECRET_HASHER, SNOWFLAKE_ID_GENERATOR],
    },
  ],
  exports: [AccountTokenService],
  configuration: configure,
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthPlugin {
  static options: AuthPluginOptions | undefined;

  /** Registers the plugin with its options. */
  static init(options: AuthPluginOptions): typeof AuthPlugin {
    AuthPlugin.options = options;
    return AuthPlugin;
  }
}
