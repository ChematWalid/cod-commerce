import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import {
  NATIVE_AUTH_STRATEGY_NAME,
  PluginCommonModule,
  type RuntimeVendureConfig,
  TransactionalConnection,
  VendurePlugin,
} from '@vendure/core';
import { AccountGuardResolver } from './api/account-guard.resolver';
import { AuthLoginController } from './api/auth-login.controller';
import { AuthTranslations } from './api/auth-translations';
import { SessionResolver } from './api/session.resolver';
import { AccountTokenService } from './application/account-token.service';
import { AuthEmailDelivery } from './application/auth-email-delivery';
import { AuthEmailService } from './application/auth-email.service';
import {
  ACCOUNT_TOKEN_REPOSITORY,
  AUTH_EMAIL_TEMPLATES,
  EMAIL_SENDER,
  PAYLOAD_SEALER,
  SECRET_HASHER,
  SESSION_TERMINATOR,
} from './application/tokens';
import { ADMINISTRATOR_PHONE_MAX_LENGTH, EMAIL_LOCALE_LENGTH } from './domain/constants';
import type { AccountTokenRepositoryPort } from './domain/ports/account-token-repository.port';
import type { AuthEmailTemplatesPort } from './domain/ports/auth-email-templates.port';
import type { EmailSenderPort } from './domain/ports/email-sender.port';
import type { PayloadSealerPort } from './domain/ports/payload-sealer.port';
import type { SecretHasherPort } from './domain/ports/secret-hasher.port';
import { AccountPasswordValidationStrategy } from './infrastructure/account-password-validation.strategy';
import { accountTokenPurgeTask } from './infrastructure/account-token-purge.task';
import { AccountTokenEntity } from './infrastructure/account-token.entity';
import { AuthEmailJobs, EventBusAuthEmailQueue } from './infrastructure/auth-email-queue';
import { HmacSecretHasher } from './infrastructure/hmac-secret-hasher';
import { NodemailerEmailSender, type SmtpOptions } from './infrastructure/nodemailer-email-sender';
import { SealedPayloadCodec } from './infrastructure/sealed-payload';
import { SessionTerminator } from './infrastructure/session-terminator';
import { ThrottledNativeAuthenticationStrategy } from './infrastructure/throttled-native-authentication.strategy';
import { TypeOrmAccountTokenRepository } from './infrastructure/typeorm-account-token.repository';

/** How {@link AuthPlugin} is configured. */
export interface AuthPluginOptions {
  /** `AUTH_TOKEN_SECRET`: the HMAC key of account tokens and codes. Rotating it voids the open ones (D25). */
  readonly tokenSecret: string;
  readonly email: AuthEmailOptions;
}

/** The mail side of {@link AuthPluginOptions}. */
export interface AuthEmailOptions {
  /** `SMTP_HOST`, `SMTP_PORT` and `SMTP_FROM`. */
  readonly smtp: SmtpOptions;
  /** The wording of the emails; the server owns it (D32). */
  readonly templates: AuthEmailTemplatesPort;
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
  const { authOptions } = config;
  authOptions.adminAuthenticationStrategy = [
    new ThrottledNativeAuthenticationStrategy(),
    ...authOptions.adminAuthenticationStrategy.filter((strategy) => strategy.name !== NATIVE_AUTH_STRATEGY_NAME),
  ];
  authOptions.passwordValidationStrategy = new AccountPasswordValidationStrategy();
  return config;
}

/** Merchant accounts: this module only wires the layers. */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, RateLimitPlugin],
  entities: [AccountTokenEntity],
  providers: [
    {
      provide: ACCOUNT_TOKEN_REPOSITORY,
      useFactory: (connection: TransactionalConnection) => new TypeOrmAccountTokenRepository(connection),
      inject: [TransactionalConnection],
    },
    { provide: SECRET_HASHER, useFactory: () => new HmacSecretHasher(requireOptions().tokenSecret) },
    { provide: PAYLOAD_SEALER, useFactory: () => new SealedPayloadCodec(requireOptions().tokenSecret) },
    { provide: AUTH_EMAIL_TEMPLATES, useFactory: () => requireOptions().email.templates },
    { provide: EMAIL_SENDER, useFactory: () => NodemailerEmailSender.connect(requireOptions().email.smtp) },
    EventBusAuthEmailQueue,
    {
      provide: AuthEmailService,
      useFactory: (queue: EventBusAuthEmailQueue, sealer: PayloadSealerPort) => new AuthEmailService(queue, sealer),
      inject: [EventBusAuthEmailQueue, PAYLOAD_SEALER],
    },
    {
      provide: AuthEmailDelivery,
      useFactory: (
        sealer: PayloadSealerPort,
        templates: AuthEmailTemplatesPort,
        sender: EmailSenderPort,
        hasher: SecretHasherPort,
      ) => new AuthEmailDelivery(sealer, templates, sender, hasher),
      inject: [PAYLOAD_SEALER, AUTH_EMAIL_TEMPLATES, EMAIL_SENDER, SECRET_HASHER],
    },
    AuthEmailJobs,
    AuthTranslations,
    { provide: SESSION_TERMINATOR, useClass: SessionTerminator },
    {
      provide: AccountTokenService,
      useFactory: (tokens: AccountTokenRepositoryPort, hasher: SecretHasherPort, ids: SnowflakeIdGeneratorPort) =>
        new AccountTokenService(tokens, hasher, ids, systemClock),
      inject: [ACCOUNT_TOKEN_REPOSITORY, SECRET_HASHER, SNOWFLAKE_ID_GENERATOR],
    },
  ],
  exports: [AccountTokenService, AuthEmailService],
  // No schema: these two replace the stock resolvers of `logout` and `updateActiveAdministrator` (D21).
  adminApiExtensions: { resolvers: [SessionResolver, AccountGuardResolver] },
  controllers: [AuthLoginController],
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
