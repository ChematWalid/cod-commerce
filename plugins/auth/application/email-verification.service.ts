import { otpSchema, RESEND_COOLDOWN_MS, VERIFY_LINK_TTL_MS } from '@cod/shared';
import { accountLink } from '../domain/account-link';
import { VERIFY_EMAIL_PATH } from '../domain/constants';
import { InvalidTokenError, OtpInvalidError } from '../domain/errors';
import type { AccountThrottlePort } from '../domain/ports/account-credentials.port';
import type { AccountIdentityPort, AccountRecord } from '../domain/ports/account-identity.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';

/** What {@link EmailVerificationService} works with. */
export interface EmailVerificationPorts {
  readonly identity: Pick<AccountIdentityPort, 'inTransaction' | 'findByUserId' | 'markEmailVerified'>;
  readonly tokens: Pick<
    AccountTokenService,
    'consume' | 'matchOtp' | 'consumeMatchedOtp' | 'issueAfterCooldown' | 'lastIssuedAt' | 'pendingEmailOf'
  >;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
  readonly throttle: Pick<AccountThrottlePort, 'spendForUser'>;
  readonly clock: ClockPort;
  readonly dashboardUrl: string;
}

/** When a verification email went out and when the next may. */
export interface ResendResult {
  readonly sentAt: Date;
  readonly nextAllowedAt: Date;
}

/** The email banner's whole view of the account. */
export interface AccountStatus {
  readonly emailVerified: boolean;
  readonly verificationRequired: boolean;
  readonly resendAvailableAt: Date | null;
  readonly pendingEmail: string | null;
}

/** Proves a merchant owns the email: by the link or the code of one shared `account_token` row (D23, D26). */
export class EmailVerificationService {
  constructor(private readonly ports: EmailVerificationPorts) {}

  /** @throws InvalidTokenError for an unknown, expired or used link. */
  verifyByLink(ctx: OperationContext, token: string): Promise<void> {
    return this.ports.identity.inTransaction(ctx, async (transactional) => {
      const { userId } = await this.ports.tokens.consume(transactional, 'email-verification', token);
      await this.markVerified(transactional, userId);
    });
  }

  /**
   * The guess is counted and compared first, committed on its own; using the token and marking the email verified
   * then commit together, so a failed write leaves the code usable (D607).
   *
   * @throws OtpInvalidError or OtpLockedError.
   */
  async verifyByCode(ctx: OperationContext, userId: number, code: string): Promise<void> {
    await this.ports.throttle.spendForUser('otp-account', userId);
    if (!otpSchema.safeParse(code).success) {
      throw new OtpInvalidError();
    }
    // A resend gives fresh tries, so only this cap bounds the guesses at codes over time (D44).
    await this.ports.throttle.spendForUser('otp-account-daily', userId);
    const matched = await this.ports.tokens.matchOtp(userId, code);
    await this.ports.identity.inTransaction(ctx, async (transactional) => {
      const consumed = await this.ports.tokens.consumeMatchedOtp(transactional, matched);
      await this.markVerified(transactional, consumed.userId);
    });
  }

  /** @throws CooldownError inside the cooldown. */
  resend(ctx: OperationContext, userId: number): Promise<ResendResult> {
    return this.ports.identity.inTransaction(ctx, (transactional) => this.sendAgain(transactional, userId));
  }

  /** The account's verification state, for the signed-in owner. */
  async status(ctx: OperationContext, userId: number): Promise<AccountStatus> {
    const account = await this.accountOf(ctx, userId);
    const { tokens, clock } = this.ports;
    const [lastSent, pendingEmail] = await Promise.all([
      tokens.lastIssuedAt(ctx, userId, 'email-verification'),
      tokens.pendingEmailOf(ctx, userId),
    ]);
    const availableAt = lastSent === undefined ? null : new Date(lastSent.getTime() + RESEND_COOLDOWN_MS);
    return {
      emailVerified: account.emailVerifiedAt !== null,
      verificationRequired: account.businessId !== null,
      resendAvailableAt: availableAt !== null && availableAt > clock.now() ? availableAt : null,
      pendingEmail,
    };
  }

  private async sendAgain(ctx: OperationContext, userId: number): Promise<ResendResult> {
    const { tokens, emails, clock, dashboardUrl } = this.ports;
    const account = await this.accountOf(ctx, userId);
    const { token, otp } = await tokens.issueAfterCooldown(
      ctx,
      { userId, purpose: 'email-verification', ttlMs: VERIFY_LINK_TTL_MS, withOtp: true },
      RESEND_COOLDOWN_MS,
    );
    await emails.enqueue(ctx, {
      kind: 'verification',
      to: account.email,
      locale: account.locale,
      vars: { name: account.firstName, link: accountLink(dashboardUrl, VERIFY_EMAIL_PATH, token), code: otp ?? '' },
    });
    const sentAt = clock.now();
    return { sentAt, nextAllowedAt: new Date(sentAt.getTime() + RESEND_COOLDOWN_MS) };
  }

  private async markVerified(ctx: OperationContext, userId: number | null): Promise<void> {
    const account = userId === null ? undefined : await this.ports.identity.findByUserId(ctx, userId);
    if (account === undefined) {
      throw new InvalidTokenError();
    }
    if (account.emailVerifiedAt === null) {
      await this.ports.identity.markEmailVerified(ctx, account.administratorId, this.ports.clock.now());
    }
  }

  private async accountOf(ctx: OperationContext, userId: number): Promise<AccountRecord> {
    const account = await this.ports.identity.findByUserId(ctx, userId);
    if (account === undefined) {
      throw new InvalidTokenError();
    }
    return account;
  }
}
