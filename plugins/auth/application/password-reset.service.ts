import { normalizeEmail, passwordSchema, RESET_TOKEN_TTL_MS } from '@cod/shared';
import { accountLink } from '../domain/account-link';
import { RESET_PASSWORD_PATH } from '../domain/constants';
import { InvalidTokenError, PasswordPolicyError } from '../domain/errors';
import type {
  AccountPasswordsPort,
  AccountSessionsPort,
  AccountThrottlePort,
  OpenedSession,
} from '../domain/ports/account-credentials.port';
import type { AccountIdentityPort, AccountRecord } from '../domain/ports/account-identity.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';

/** What {@link PasswordResetService} works with. */
export interface PasswordResetPorts {
  readonly identity: Pick<AccountIdentityPort, 'inTransaction' | 'findByEmail' | 'findByUserId' | 'markEmailVerified'>;
  readonly passwords: Pick<AccountPasswordsPort, 'set'>;
  readonly sessions: AccountSessionsPort;
  readonly throttle: Pick<AccountThrottlePort, 'spendForEmail' | 'clearLoginLockout'>;
  readonly tokens: Pick<AccountTokenService, 'issue' | 'consume' | 'voidOpen'>;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
  readonly clock: ClockPort;
  readonly dashboardUrl: string;
}

/** Forgot password: our hashed token in place of the stock plaintext column (D21, D25). */
export class PasswordResetService {
  constructor(private readonly ports: PasswordResetPorts) {}

  /** Mails a link when the email has an account, and answers the same either way (D27). */
  async request(ctx: OperationContext, rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.ports.throttle.spendForEmail('reset-account', email);
    const account = await this.ports.identity.findByEmail(ctx, email);
    if (account !== undefined) {
      await this.ports.identity.inTransaction(ctx, (transactional) => this.mailLink(transactional, account));
    }
  }

  /**
   * The password is checked before the token is spent, so a weak one costs the owner no second email. Sessions end
   * after the commit: evicting them earlier would let a concurrent request re-cache one from its still visible row.
   *
   * @throws PasswordPolicyError or InvalidTokenError.
   */
  async reset(ctx: OperationContext, token: string, password: string): Promise<OpenedSession> {
    if (!passwordSchema.safeParse(password).success) {
      throw new PasswordPolicyError();
    }
    const { identity, sessions, throttle } = this.ports;
    const account = await identity.inTransaction(ctx, (transactional) => this.apply(transactional, token, password));
    await sessions.endAll(ctx, account.userId);
    await throttle.clearLoginLockout(ctx, account.email);
    return sessions.open(ctx, account.userId);
  }

  private async mailLink(ctx: OperationContext, account: AccountRecord): Promise<void> {
    const { tokens, emails, dashboardUrl } = this.ports;
    const { token } = await tokens.issue(ctx, {
      userId: account.userId,
      purpose: 'password-reset',
      ttlMs: RESET_TOKEN_TTL_MS,
    });
    await emails.enqueue(ctx, {
      kind: 'password-reset',
      to: account.email,
      locale: account.locale,
      vars: { name: account.firstName, link: accountLink(dashboardUrl, RESET_PASSWORD_PATH, token) },
    });
  }

  private async apply(ctx: OperationContext, token: string, password: string): Promise<AccountRecord> {
    const { identity, passwords, tokens, clock } = this.ports;
    const { userId } = await tokens.consume(ctx, 'password-reset', token);
    const account = userId === null ? undefined : await identity.findByUserId(ctx, userId);
    if (account === undefined) {
      throw new InvalidTokenError();
    }
    await passwords.set(ctx, account.userId, password);
    await tokens.voidOpen(ctx, account.userId, ['password-reset', 'email-change']);
    if (account.emailVerifiedAt === null) {
      await identity.markEmailVerified(ctx, account.administratorId, clock.now());
    }
    return account;
  }
}
