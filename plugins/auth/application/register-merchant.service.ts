import type { ProvisionBusinessCommand, ProvisionedBusiness } from '@cod/plugin-tenancy';
import {
  AUTH_ERROR_CODES,
  type RegisterMerchantCommand,
  registerMerchantSchema,
  VERIFY_LINK_TTL_MS,
} from '@cod/shared';
import { VERIFY_EMAIL_PATH } from '../domain/constants';
import { AUTH_EMAIL_LOCALES, type AuthEmailLocale } from '../domain/email';
import { ChallengeFailedError, EmailTakenError, PasswordPolicyError, RegistrationInvalidError } from '../domain/errors';
import type { AccountIdentityPort, EmailClaimPort } from '../domain/ports/account-identity.port';
import type { BotChallengePort } from '../domain/ports/bot-challenge.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';

/** Starts a business for the new owner; tenancy's one provisioning path (D5). */
export interface BusinessProvisioner {
  provision(ctx: OperationContext, command: ProvisionBusinessCommand): Promise<ProvisionedBusiness>;
}

/** What {@link RegisterMerchantService} works with. */
export interface RegisterMerchantPorts {
  readonly challenge: BotChallengePort;
  readonly identity: AccountIdentityPort;
  readonly claims: EmailClaimPort;
  readonly provisioner: BusinessProvisioner;
  readonly tokens: Pick<AccountTokenService, 'issue'>;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
  /** `AUTH_DASHBOARD_URL`, which verification links start with. */
  readonly dashboardUrl: string;
}

/** What a registration made. It opens no session: the client logs in afterwards. */
export interface RegisterMerchantResult {
  readonly businessId: string;
  readonly storeId: string;
  readonly verificationEmailSent: boolean;
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
   * @throws PasswordPolicyError, RegistrationInvalidError, ChallengeFailedError, EmailTakenError, or what tenancy's
   * provisioning throws, such as a taken or reserved subdomain.
   */
  async register(ctx: OperationContext, input: unknown): Promise<RegisterMerchantResult> {
    const command = parseRegistration(input);
    if ((await this.ports.challenge.verify(command.challengeToken)) === 'failed') {
      throw new ChallengeFailedError();
    }
    return this.ports.identity.inTransaction(ctx, (transactional) => this.registerIn(transactional, command));
  }

  private async registerIn(ctx: OperationContext, command: RegisterMerchantCommand): Promise<RegisterMerchantResult> {
    const { identity, claims, provisioner } = this.ports;
    await claims.claim(ctx, command.email);
    if (await identity.isEmailTaken(ctx, command.email)) {
      throw new EmailTakenError();
    }
    const { business, store, administratorId } = await provisioner.provision(ctx, {
      name: command.businessName,
      owner: {
        emailAddress: command.email,
        firstName: command.firstName,
        lastName: command.lastName,
        password: command.password,
      },
      store: { name: command.storeName, subdomain: command.subdomain, language: command.storeLanguage },
    });
    await this.sendVerification(ctx, command, administratorId);
    return { businessId: business.id, storeId: store.id, verificationEmailSent: true };
  }

  private async sendVerification(
    ctx: OperationContext,
    command: RegisterMerchantCommand,
    administratorId: number,
  ): Promise<void> {
    const { identity, tokens, emails, dashboardUrl } = this.ports;
    const locale = emailLocaleOf(command.emailLocale);
    await identity.setEmailLocale(ctx, administratorId, locale);
    const userId = await identity.userIdOfAdministrator(ctx, administratorId);
    const { token, otp } = await tokens.issue(ctx, {
      userId,
      purpose: 'email-verification',
      ttlMs: VERIFY_LINK_TTL_MS,
      withOtp: true,
    });
    const link = `${dashboardUrl.replace(/\/+$/, '')}${VERIFY_EMAIL_PATH}?token=${token}`;
    await emails.enqueue(ctx, {
      kind: 'verification',
      to: command.email,
      locale,
      vars: { name: command.firstName, link, code: otp ?? '' },
    });
  }
}
