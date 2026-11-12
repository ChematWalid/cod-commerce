import {
  AUTH_ERROR_CODES,
  type RegisterMerchantCommand,
  registerMerchantSchema,
  VERIFY_LINK_TTL_MS,
} from '@cod/shared';
import { accountLink } from '../domain/account-link';
import { VERIFY_EMAIL_PATH } from '../domain/constants';
import { AUTH_EMAIL_LOCALES, type AuthEmailLocale } from '../domain/email';
import { ChallengeFailedError, EmailTakenError, PasswordPolicyError, RegistrationInvalidError } from '../domain/errors';
import type { AccountIdentityPort, EmailClaimPort } from '../domain/ports/account-identity.port';
import type { BotChallengePort } from '../domain/ports/bot-challenge.port';
import type { BusinessProvisionerPort, ProvisionOutcome } from '../domain/ports/business-provisioner.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';
import type { OAuthSignInService, RedeemedOAuthRegistration } from './oauth-sign-in.service';

/** What {@link RegisterMerchantService} works with. */
export interface RegisterMerchantPorts {
  readonly challenge: BotChallengePort;
  readonly identity: Pick<
    AccountIdentityPort,
    'inTransaction' | 'isEmailTaken' | 'setEmailLocale' | 'userIdOfAdministrator'
  >;
  readonly claims: EmailClaimPort;
  readonly provisioner: BusinessProvisionerPort;
  readonly tokens: Pick<AccountTokenService, 'issue'>;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
  /** `AUTH_DASHBOARD_URL`, which verification links start with. */
  readonly dashboardUrl: string;
  /** Left out while `AUTH_OAUTH_ENABLED` is false; a ticket is then refused. */
  readonly oauth?: Pick<OAuthSignInService, 'redeemForRegistration' | 'assertSubjectFree' | 'finishRegistration'>;
}

/** What a registration made. It opens no session: the client logs in afterwards. */
export interface RegisterMerchantResult {
  readonly businessId: string;
  readonly storeId: string;
  readonly verificationEmailSent: boolean;
  /** For a provider sign-up, which has no password to log in with: spent through strategy `oauth`. */
  readonly signInTicket?: string;
}

/** What a registration that came through a provider adds to the plain one. */
interface RegistrationSource {
  readonly email: string;
  readonly password: string;
  readonly oauth: RedeemedOAuthRegistration | undefined;
}

/** The column's default: a store language with no email templates (French) gets this one. */
const DEFAULT_EMAIL_LOCALE: AuthEmailLocale = 'ar';

function emailLocaleOf(language: string): AuthEmailLocale {
  return AUTH_EMAIL_LOCALES.find((locale) => locale === language) ?? DEFAULT_EMAIL_LOCALE;
}

/** Runs the shared schema (ADR 0017 §1). Only field names leave here: the values include the password. */
function parseRegistration(input: unknown): RegisterMerchantCommand {
  const parsed = registerMerchantSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data;
  }
  if (parsed.error.issues.some((issue) => issue.message === AUTH_ERROR_CODES.PASSWORD_POLICY)) {
    throw new PasswordPolicyError();
  }
  throw new RegistrationInvalidError([
    ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'input'))),
  ]);
}

/** Signs a merchant up: account, business and first store appear together or not at all. */
export class RegisterMerchantService {
  constructor(private readonly ports: RegisterMerchantPorts) {}

  /**
   * Validates `input`, passes the challenge, then does the rest in one transaction. The email is queued only when
   * that transaction commits.
   *
   * @param oauthBinding The browser's binding cookie, which a provider ticket must match (D36).
   * @throws PasswordPolicyError, RegistrationInvalidError, ChallengeFailedError, EmailTakenError, InvalidTokenError
   * for a bad provider ticket, or what tenancy's provisioning throws, such as a taken or reserved subdomain.
   */
  async register(ctx: OperationContext, input: unknown, oauthBinding?: string): Promise<RegisterMerchantResult> {
    const command = parseRegistration(input);
    if (command.oauthTicket !== undefined && this.ports.oauth === undefined) {
      throw new RegistrationInvalidError(['oauthTicket']);
    }
    if ((await this.ports.challenge.verify(command.challengeToken)) === 'failed') {
      throw new ChallengeFailedError();
    }
    const { result, store } = await this.ports.identity.inTransaction(ctx, (transactional) =>
      this.registerIn(transactional, command, oauthBinding),
    );
    await this.ports.provisioner.forgetStoreHost(store);
    return result;
  }

  private async registerIn(
    ctx: OperationContext,
    command: RegisterMerchantCommand,
    oauthBinding: string | undefined,
  ): Promise<{ result: RegisterMerchantResult; store: ProvisionOutcome['store'] }> {
    const { identity, claims, provisioner, oauth } = this.ports;
    const source = await this.sourceOf(ctx, command, oauthBinding);
    await claims.claim(ctx, source.email);
    if (await identity.isEmailTaken(ctx, source.email)) {
      throw new EmailTakenError();
    }
    if (source.oauth !== undefined) {
      await oauth?.assertSubjectFree(ctx, source.oauth.identity);
    }
    const { business, store, administratorId } = await provisioner.provision(ctx, {
      name: command.businessName,
      owner: {
        emailAddress: source.email,
        firstName: command.firstName,
        lastName: command.lastName,
        password: source.password,
      },
      store: { name: command.storeName, subdomain: command.subdomain, language: command.storeLanguage },
    });
    const outcome = await this.finishAccount(ctx, command, source, administratorId);
    return { result: { businessId: business.id, storeId: store.id, ...outcome }, store };
  }

  /** The email a confirmed provider vouched for wins over what the form sent: it is the one that was proven. */
  private async sourceOf(
    ctx: OperationContext,
    command: RegisterMerchantCommand,
    oauthBinding: string | undefined,
  ): Promise<RegistrationSource> {
    const { oauthTicket, email, password } = command;
    if (oauthTicket === undefined) {
      if (password === undefined) {
        throw new RegistrationInvalidError(['password']);
      }
      return { email, password, oauth: undefined };
    }
    const oauth = await this.ports.oauth?.redeemForRegistration(ctx, oauthTicket, oauthBinding);
    if (oauth === undefined) {
      throw new RegistrationInvalidError(['oauthTicket']);
    }
    const proven = oauth.identity.emailVerified ? oauth.identity.email : null;
    return { email: proven ?? email, password: oauth.password, oauth };
  }

  private async finishAccount(
    ctx: OperationContext,
    command: RegisterMerchantCommand,
    source: RegistrationSource,
    administratorId: number,
  ): Promise<Pick<RegisterMerchantResult, 'verificationEmailSent' | 'signInTicket'>> {
    const { identity, oauth } = this.ports;
    const locale = emailLocaleOf(command.emailLocale);
    await identity.setEmailLocale(ctx, administratorId, locale);
    const userId = await identity.userIdOfAdministrator(ctx, administratorId);
    const outcome =
      source.oauth === undefined
        ? undefined
        : await oauth?.finishRegistration(ctx, source.oauth, { userId, administratorId });
    if (outcome?.emailVerified !== true) {
      await this.sendVerification(ctx, command, { email: source.email, userId, locale });
    }
    return {
      verificationEmailSent: outcome?.emailVerified !== true,
      ...(outcome === undefined ? {} : { signInTicket: outcome.signInTicket }),
    };
  }

  private async sendVerification(
    ctx: OperationContext,
    command: RegisterMerchantCommand,
    { email, userId, locale }: { readonly email: string; readonly userId: number; readonly locale: AuthEmailLocale },
  ): Promise<void> {
    const { tokens, emails, dashboardUrl } = this.ports;
    const { token, otp } = await tokens.issue(ctx, {
      userId,
      purpose: 'email-verification',
      ttlMs: VERIFY_LINK_TTL_MS,
      withOtp: true,
    });
    const link = accountLink(dashboardUrl, VERIFY_EMAIL_PATH, token);
    await emails.enqueue(ctx, {
      kind: 'verification',
      to: email,
      locale,
      vars: { name: command.firstName, link, code: otp ?? '' },
    });
  }
}
