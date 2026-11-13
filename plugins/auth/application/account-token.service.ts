import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '@cod/shared';
import {
  type AccountToken,
  type AccountTokenPayload,
  type AccountTokenPurpose,
  type NewAccountToken,
  type OtpAttemptWindow,
} from '../domain/account-token';
import { CooldownError, InvalidTokenError, OtpInvalidError, OtpLockedError } from '../domain/errors';
import type { AccountTokenRepositoryPort } from '../domain/ports/account-token-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SecretHasherPort } from '../domain/ports/secret-hasher.port';

/** What {@link AccountTokenService.issue} stores. `userId` is null only for an `oauth-ticket`. */
export interface IssueAccountTokenCommand {
  readonly userId: number | null;
  readonly purpose: AccountTokenPurpose;
  readonly ttlMs: number;
  readonly withOtp?: boolean;
  readonly pendingEmail?: string;
  readonly payload?: AccountTokenPayload;
}

/** The raw secrets of a new token: returned once, to be mailed, and never stored. */
export interface IssuedAccountToken {
  readonly token: string;
  readonly otp?: string;
}

/** Single-use account tokens and their one-time codes, kept only as HMACs (D24, D25, D26). */
export class AccountTokenService {
  constructor(
    private readonly tokens: AccountTokenRepositoryPort,
    private readonly hasher: SecretHasherPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  /** Creates a token, voiding the user's earlier open ones of that purpose. */
  async issue(ctx: OperationContext, command: IssueAccountTokenCommand): Promise<IssuedAccountToken> {
    const { row, secrets } = this.newRow(command, this.clock.now());
    await this.tokens.replaceOpen(ctx, row);
    return secrets;
  }

  /**
   * {@link issue}, unless the user's latest token of that purpose is younger than `cooldownMs`. Checked under the
   * lock that serializes issuing, so a double click sends one email.
   *
   * @throws CooldownError inside the cooldown.
   */
  async issueAfterCooldown(
    ctx: OperationContext,
    command: IssueAccountTokenCommand,
    cooldownMs: number,
  ): Promise<IssuedAccountToken> {
    const now = this.clock.now();
    const { row, secrets } = this.newRow(command, now);
    if (!(await this.tokens.replaceOpen(ctx, row, new Date(now.getTime() - cooldownMs)))) {
      throw new CooldownError();
    }
    return secrets;
  }

  private newRow(command: IssueAccountTokenCommand, now: Date): { row: NewAccountToken; secrets: IssuedAccountToken } {
    const token = this.hasher.newToken();
    const otp = command.withOtp === true ? this.hasher.newOtp() : undefined;
    const row: NewAccountToken = {
      id: this.ids.next(),
      userId: command.userId,
      purpose: command.purpose,
      tokenHash: this.hasher.hash(token),
      otpHash: otp === undefined ? null : this.hasher.hash(otp),
      pendingEmail: command.pendingEmail ?? null,
      payload: command.payload ?? null,
      expiresAt: new Date(now.getTime() + command.ttlMs),
      createdAt: now,
    };
    return { row, secrets: otp === undefined ? { token } : { token, otp } };
  }

  /**
   * Uses a token once.
   *
   * @throws InvalidTokenError alike for an unknown, expired, already used or other-purpose token.
   */
  async consume(ctx: OperationContext, purpose: AccountTokenPurpose, token: string): Promise<AccountToken> {
    const consumed = await this.tokens.consumeByHash(ctx, purpose, this.hasher.hash(token), this.clock.now());
    if (consumed === undefined) {
      throw new InvalidTokenError();
    }
    return consumed;
  }

  /**
   * The open ticket of this browser, without spending it.
   *
   * @throws InvalidTokenError for an unknown, expired or used token, or one bound to another browser.
   */
  async peekBound(
    ctx: OperationContext,
    purpose: AccountTokenPurpose,
    token: string,
    binding: string | undefined,
  ): Promise<AccountToken> {
    const open = await this.tokens.findOpenByHash(ctx, purpose, this.hasher.hash(token), this.clock.now());
    const bindingHash = open?.payload?.['bindingHash'];
    if (open === undefined || binding === undefined || typeof bindingHash !== 'string') {
      throw new InvalidTokenError();
    }
    if (!this.hasher.matches(binding, bindingHash)) {
      throw new InvalidTokenError();
    }
    return open;
  }

  /**
   * {@link consume} for a token bound to a browser. The browser is checked first, so another browser cannot burn it.
   *
   * @throws InvalidTokenError as {@link peekBound}, or when a concurrent caller spent it first.
   */
  async consumeBound(
    ctx: OperationContext,
    purpose: AccountTokenPurpose,
    token: string,
    binding: string | undefined,
  ): Promise<AccountToken> {
    await this.peekBound(ctx, purpose, token, binding);
    return this.consume(ctx, purpose, token);
  }

  /**
   * Counts one guess at the user's emailed code and compares it, spending nothing else. The guess is counted before
   * the code is compared, in one conditional statement, so concurrent guesses cannot compare more than
   * `OTP_MAX_ATTEMPTS` times. It commits on its own connection, so the error it causes cannot roll it back.
   *
   * Call it before opening a transaction: one that already holds this row would block that commit forever.
   *
   * @throws OtpInvalidError for a wrong code, or when no code is open.
   * @throws OtpLockedError once the guesses are spent, even for the right code.
   */
  async matchOtp(userId: number, otp: string): Promise<AccountToken> {
    const window = this.otpWindow();
    const claimed = await this.tokens.claimOtpAttempt(userId, window);
    if (claimed === undefined) {
      throw await this.refusalOf(userId, window);
    }
    if (claimed.otpHash === null || !this.hasher.matches(otp, claimed.otpHash)) {
      throw claimed.otpAttempts >= OTP_MAX_ATTEMPTS ? new OtpLockedError() : new OtpInvalidError();
    }
    return claimed;
  }

  /**
   * Uses the token whose code {@link matchOtp} accepted, in `ctx`: a caller transaction that rolls back reopens it,
   * with the guess still counted. Run it in the same transaction as the write the code unlocks, so a failed write
   * leaves the code usable (AUTH-9, D607).
   *
   * @throws OtpInvalidError when a concurrent caller used it first.
   */
  async consumeMatchedOtp(ctx: OperationContext, matched: AccountToken): Promise<AccountToken> {
    const consumed = await this.tokens.consumeOtpToken(ctx, matched.id, this.clock.now());
    if (consumed === undefined) {
      throw new OtpInvalidError();
    }
    return consumed;
  }

  /** Ends the user's open tokens of these purposes. */
  async voidOpen(ctx: OperationContext, userId: number, purposes: readonly AccountTokenPurpose[]): Promise<void> {
    await this.tokens.voidOpen(ctx, userId, purposes, this.clock.now());
  }

  /** When the latest token of this purpose was issued, for the resend cooldown. */
  lastIssuedAt(ctx: OperationContext, userId: number, purpose: AccountTokenPurpose): Promise<Date | undefined> {
    return this.tokens.lastIssuedAt(ctx, userId, purpose);
  }

  /** The address of the user's open email change, if one is open. */
  async pendingEmailOf(ctx: OperationContext, userId: number): Promise<string | null> {
    const open = await this.tokens.findOpen(ctx, userId, 'email-change', this.clock.now());
    return open?.pendingEmail ?? null;
  }

  private otpWindow(): OtpAttemptWindow {
    const now = this.clock.now();
    return { now, issuedAfter: new Date(now.getTime() - OTP_TTL_MS), maxAttempts: OTP_MAX_ATTEMPTS };
  }

  private async refusalOf(userId: number, window: OtpAttemptWindow): Promise<OtpInvalidError | OtpLockedError> {
    const open = await this.tokens.findOpenOtp(userId, window);
    return open === undefined ? new OtpInvalidError() : new OtpLockedError();
  }
}
