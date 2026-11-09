import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import {
  asOperationContext,
  ProvisionBusinessService,
  type SnowflakeIdGeneratorPort,
  SNOWFLAKE_ID_GENERATOR,
  TenancyPlugin,
} from '@cod/plugin-tenancy';
import {
  NATIVE_AUTH_STRATEGY_NAME,
  PluginCommonModule,
  type RuntimeVendureConfig,
  TransactionalConnection,
  VendurePlugin,
} from '@vendure/core';
import { AccountEmailResolver } from './api/account-email.resolver';
import { AccountGuardResolver } from './api/account-guard.resolver';
import { AuthAccountController } from './api/auth-account.controller';
import { AuthConfigController } from './api/auth-config.controller';
import { AuthLoginController } from './api/auth-login.controller';
import { AuthPasswordController } from './api/auth-password.controller';
import { AuthProfileController } from './api/auth-profile.controller';
import { AuthRegisterController } from './api/auth-register.controller';
import { AuthTranslations } from './api/auth-translations';
import { LogoUploadResolver } from './api/logo-upload.resolver';
import { PasswordResolver } from './api/password.resolver';
import { ProfileResolver } from './api/profile.resolver';
import { RegisterResolver } from './api/register.resolver';
import { authAdminApiSchema } from './api/schema';
import { SessionResolver } from './api/session.resolver';
import { ShopAccountGuardResolver } from './api/shop-account-guard.resolver';
import { ShopPasswordResetGuardResolver } from './api/shop-password-reset-guard.resolver';
import { AccountProfileService } from './application/account-profile.service';
import { AccountTokenService } from './application/account-token.service';
import { AuthEmailDelivery } from './application/auth-email-delivery';
import { AuthEmailService } from './application/auth-email.service';
import { BusinessLogoService } from './application/business-logo.service';
import { RegisterMerchantService } from './application/register-merchant.service';
import {
  ACCOUNT_TOKEN_REPOSITORY,
  AUTH_EMAIL_TEMPLATES,
  AUTH_PUBLIC_CONFIG,
  BOT_CHALLENGE,
  EMAIL_SENDER,
  PAYLOAD_SEALER,
  SECRET_HASHER,
  SESSION_TERMINATOR,
} from './application/tokens';
import { ADMINISTRATOR_PHONE_MAX_LENGTH, EMAIL_LOCALE_LENGTH } from './domain/constants';
import { IMAGE_FORMATS } from './domain/image-format';
import type { AccountTokenRepositoryPort } from './domain/ports/account-token-repository.port';
import type { AuthEmailTemplatesPort } from './domain/ports/auth-email-templates.port';
import type { BotChallengePort } from './domain/ports/bot-challenge.port';
import type { EmailSenderPort } from './domain/ports/email-sender.port';
import type { PayloadSealerPort } from './domain/ports/payload-sealer.port';
import type { SecretHasherPort } from './domain/ports/secret-hasher.port';
import type { AuthPublicConfig } from './domain/public-config';
import { AssetContentGuard } from './infrastructure/asset-content-guard';
import { AccountPasswordValidationStrategy } from './infrastructure/account-password-validation.strategy';
import { accountFlowProviders } from './infrastructure/account-flow.providers';
import { accountTokenPurgeTask } from './infrastructure/account-token-purge.task';
import { AccountTokenEntity } from './infrastructure/account-token.entity';
import { AuthEmailJobs, EventBusAuthEmailQueue } from './infrastructure/auth-email-queue';
import { EmailClaimLock } from './infrastructure/email-claim-lock';
import { HmacSecretHasher } from './infrastructure/hmac-secret-hasher';
import { NoopBotChallenge } from './infrastructure/noop-bot-challenge';
import { NodemailerEmailSender, type SmtpOptions } from './infrastructure/nodemailer-email-sender';
import { SealedPayloadCodec } from './infrastructure/sealed-payload';
import { SessionTerminator } from './infrastructure/session-terminator';
import { ThrottledNativeAuthenticationStrategy } from './infrastructure/throttled-native-authentication.strategy';
import { TurnstileBotChallenge } from './infrastructure/turnstile-bot-challenge';
import { TypeOrmAccountTokenRepository } from './infrastructure/typeorm-account-token.repository';
import { VendureAccountIdentity } from './infrastructure/vendure-account-identity';
import { VendureAccountProfile } from './infrastructure/vendure-account-profile';
import { VendureLogoAssets } from './infrastructure/vendure-logo-assets';

/** How {@link AuthPlugin} is configured. */
export interface AuthPluginOptions {
  /** `AUTH_TOKEN_SECRET`: the HMAC key of account tokens and codes. Rotating it voids the open ones (D25). */
  readonly tokenSecret: string;
  readonly email: AuthEmailOptions;
  /** `AUTH_DASHBOARD_URL`, which account links start with. */
  readonly dashboardUrl: string;
  /** `PLATFORM_DOMAIN`, which the sign-up wizard shows after the subdomain. */
  readonly platformDomain: string;
  /** The sign-up challenge; left out while `TURNSTILE_ENABLED` is false (D35). */
  readonly challenge?: AuthChallengeOptions;
  /** OAuth providers on offer; none until the strategies are registered (D36). */
  readonly oauthProviders?: readonly string[];
}

/** The Turnstile side of {@link AuthPluginOptions}. */
export interface AuthChallengeOptions {
  readonly secretKey: string;
  /** The page holding the widget, loaded in an iframe. */
  readonly challengeUrl: string;
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

function createBotChallenge(): BotChallengePort {
  const { challenge } = requireOptions();
  return challenge === undefined ? new NoopBotChallenge() : new TurnstileBotChallenge(challenge.secretKey);
}

function publicConfig(): AuthPublicConfig {
  const { oauthProviders = [], challenge, platformDomain } = requireOptions();
  return {
    oauthEnabled: oauthProviders.length > 0,
    oauthProviders,
    challengeUrl: challenge?.challengeUrl ?? null,
    platformDomain,
  };
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
  // Profile photos and logos are the only uploads so far, and SVG is markup: core's default `image/*` admits it.
  // A later catalog session widens this for product media.
  config.assetOptions.permittedFileTypes = Object.values(IMAGE_FORMATS).map(({ mimeType }) => mimeType);
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
    { provide: BOT_CHALLENGE, useFactory: createBotChallenge },
    { provide: AUTH_PUBLIC_CONFIG, useFactory: publicConfig },
    EmailClaimLock,
    VendureAccountIdentity,
    VendureAccountProfile,
    VendureLogoAssets,
    AssetContentGuard,
    {
      provide: AccountProfileService,
      useFactory: (store: VendureAccountProfile) => new AccountProfileService(store),
      inject: [VendureAccountProfile],
    },
    {
      provide: BusinessLogoService,
      useFactory: (assets: VendureLogoAssets) => new BusinessLogoService(assets),
      inject: [VendureLogoAssets],
    },
    {
      provide: RegisterMerchantService,
      useFactory: (
        ...[challenge, identity, claims, provisioning, tokens, emails]: [
          BotChallengePort,
          VendureAccountIdentity,
          EmailClaimLock,
          ProvisionBusinessService,
          AccountTokenService,
          AuthEmailService,
        ]
      ) =>
        new RegisterMerchantService({
          challenge,
          identity,
          claims,
          provisioner: {
            provision: (ctx, command) => provisioning.provision(asOperationContext(ctx), command),
          },
          tokens,
          emails,
          dashboardUrl: requireOptions().dashboardUrl,
        }),
      inject: [
        BOT_CHALLENGE,
        VendureAccountIdentity,
        EmailClaimLock,
        ProvisionBusinessService,
        AccountTokenService,
        AuthEmailService,
      ],
    },
    ...accountFlowProviders({ dashboardUrl: () => requireOptions().dashboardUrl, clock: systemClock }),
  ],
  exports: [AccountTokenService, AuthEmailService],
  // `SessionResolver`, `AccountGuardResolver` and `PasswordResolver` replace four stock mutations (D21).
  adminApiExtensions: {
    schema: authAdminApiSchema,
    resolvers: [
      SessionResolver,
      AccountGuardResolver,
      RegisterResolver,
      AccountEmailResolver,
      PasswordResolver,
      ProfileResolver,
      LogoUploadResolver,
    ],
  },
  // Administrators' sessions also work on the Shop API, whose password mutations have none of the account rules.
  shopApiExtensions: { resolvers: [ShopAccountGuardResolver, ShopPasswordResetGuardResolver] },
  controllers: [
    AuthLoginController,
    AuthRegisterController,
    AuthConfigController,
    AuthAccountController,
    AuthPasswordController,
    AuthProfileController,
  ],
  configuration: configure,
  dashboard: './dashboard/index.tsx',
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
