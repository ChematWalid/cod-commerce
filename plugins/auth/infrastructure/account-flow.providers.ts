import { asOperationContext, ProvisionBusinessService } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { AccountTokenService } from '../application/account-token.service';
import { AuthEmailService } from '../application/auth-email.service';
import { ChangeEmailService } from '../application/change-email.service';
import { ChangePasswordService } from '../application/change-password.service';
import { EmailVerificationService } from '../application/email-verification.service';
import { OAuthSignInService } from '../application/oauth-sign-in.service';
import { PasswordResetService } from '../application/password-reset.service';
import { RegisterMerchantService } from '../application/register-merchant.service';
import { ACCOUNT_IDENTITY, BOT_CHALLENGE, PAYLOAD_SEALER, SESSION_TERMINATOR } from '../application/tokens';
import type { BotChallengePort } from '../domain/ports/bot-challenge.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { PayloadSealerPort } from '../domain/ports/payload-sealer.port';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';
import { AccountThrottle } from './account-throttle';
import { EventBusAuthEmailQueue } from './auth-email-queue';
import { EmailClaimLock } from './email-claim-lock';
import { VendureAccountIdentity } from './vendure-account-identity';
import { VendureAccountSessions } from './vendure-account-sessions';

const COMMON = [VendureAccountIdentity, AccountTokenService, AuthEmailService, AccountThrottle];
type Common = [VendureAccountIdentity, AccountTokenService, AuthEmailService, AccountThrottle];

/** What every flow service is given besides its own collaborators. */
interface FlowSettings {
  readonly dashboardUrl: () => string;
  readonly clock: ClockPort;
  readonly oauthEnabled: () => boolean;
}

type RegisterDependencies = [
  BotChallengePort,
  VendureAccountIdentity,
  EmailClaimLock,
  ProvisionBusinessService,
  AccountTokenService,
  AuthEmailService,
  OAuthSignInService,
];

function registerMerchant({ dashboardUrl, oauthEnabled }: FlowSettings): Provider {
  return {
    provide: RegisterMerchantService,
    useFactory: (...[challenge, identity, claims, provisioning, tokens, emails, oauth]: RegisterDependencies) =>
      new RegisterMerchantService({
        challenge,
        identity,
        claims,
        provisioner: {
          provision: (ctx, command) => provisioning.provision(asOperationContext(ctx), command),
        },
        tokens,
        emails,
        dashboardUrl: dashboardUrl(),
        ...(oauthEnabled() ? { oauth } : {}),
      }),
    inject: [
      BOT_CHALLENGE,
      VendureAccountIdentity,
      EmailClaimLock,
      ProvisionBusinessService,
      AccountTokenService,
      AuthEmailService,
      OAuthSignInService,
    ],
  };
}

function emailVerification({ dashboardUrl, clock }: FlowSettings): Provider {
  return {
    provide: EmailVerificationService,
    useFactory: (...[identity, tokens, emails, throttle]: Common) =>
      new EmailVerificationService({ identity, tokens, emails, throttle, clock, dashboardUrl: dashboardUrl() }),
    inject: COMMON,
  };
}

type ResetExtras = [VendureAccountSessions, SessionTerminatorPort, EventBusAuthEmailQueue, PayloadSealerPort];

function passwordReset({ dashboardUrl, clock }: FlowSettings): Provider {
  return {
    provide: PasswordResetService,
    useFactory: (
      ...[identity, tokens, emails, throttle, sessions, terminator, queue, sealer]: [...Common, ...ResetExtras]
    ) =>
      new PasswordResetService({
        identity,
        passwords: identity,
        tokens,
        emails,
        throttle,
        sessions,
        terminator,
        queue,
        sealer,
        clock,
        dashboardUrl: dashboardUrl(),
      }),
    inject: [...COMMON, VendureAccountSessions, SESSION_TERMINATOR, EventBusAuthEmailQueue, PAYLOAD_SEALER],
  };
}

const changePassword: Provider = {
  provide: ChangePasswordService,
  useFactory: (...[identity, tokens, emails, throttle, terminator]: [...Common, SessionTerminatorPort]) =>
    new ChangePasswordService({ identity, passwords: identity, tokens, emails, throttle, terminator }),
  inject: [...COMMON, SESSION_TERMINATOR],
};

function changeEmail({ dashboardUrl, clock }: FlowSettings): Provider {
  return {
    provide: ChangeEmailService,
    useFactory: (...[identity, tokens, emails, throttle, claims]: [...Common, EmailClaimLock]) =>
      new ChangeEmailService({
        identity,
        passwords: identity,
        tokens,
        emails,
        throttle,
        claims,
        clock,
        dashboardUrl: dashboardUrl(),
      }),
    inject: [...COMMON, EmailClaimLock],
  };
}

/** The Nest wiring of the verification, reset and change services; `application/` stays free of Nest. */
export function accountFlowProviders(settings: FlowSettings): Provider[] {
  return [
    AccountThrottle,
    VendureAccountSessions,
    { provide: ACCOUNT_IDENTITY, useExisting: VendureAccountIdentity },
    registerMerchant(settings),
    emailVerification(settings),
    passwordReset(settings),
    changePassword,
    changeEmail(settings),
  ];
}
