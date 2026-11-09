import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '@cod/shared';
import {
  type AccountToken,
  type AccountTokenPayload,
  type AccountTokenPurpose,
  type OtpAttemptWindow,
} from '../domain/account-token';
import { InvalidTokenError, OtpInvalidError, OtpLockedError } from '../domain/errors';
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
    const now = this.clock.now();
    const token = this.hasher.newToken();
    const otp = command.withOtp === true ? this.hasher.newOtp() : undefined;
    await this.tokens.replaceOpen(ctx, {
      id: this.ids.next(),
      userId: command.userId,
      purpose: command.purpose,
      tokenHash: this.hasher.hash(token),
      otpHash: otp === undefined ? null : this.hasher.hash(otp),
      pendingEmail: command.pendingEmail ?? null,
      payload: command.payload ?? null,
      expiresAt: new Date(now.getTime() + command.ttlMs),
      createdAt: now,
    });
    return otp === undefined ? { token } : { token, otp };
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
   * Tries the user's emailed code. The guess is counted before the code is compared, so concurrent guesses cannot
   * compare more than `OTP_MAX_ATTEMPTS` times.
   *
   * @throws OtpInvalidError for a wrong code, or when no code is open.
   * @throws OtpLockedError once the guesses are spent, even for the right code.
   */
  async attemptOtp(ctx: OperationContext, userId: number, otp: string): Promise<AccountToken> {
    const window = this.otpWindow();
    const claimed = await this.tokens.claimOtpAttempt(userId, window);
    if (claimed === undefined) {
      throw await this.refusalOf(userId, window);
    }
    if (claimed.otpHash === null || !this.hasher.matches(otp, claimed.otpHash)) {
      throw claimed.otpAttempts >= OTP_MAX_ATTEMPTS ? new OtpLockedError() : new OtpInvalidError();
    }
    const consumed = await this.tokens.consumeOtpToken(ctx, claimed.id, window.now);
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

  private otpWindow(): OtpAttemptWindow {
    const now = this.clock.now();
    return { now, issuedAfter: new Date(now.getTime() - OTP_TTL_MS), maxAttempts: OTP_MAX_ATTEMPTS };
  }

  private async refusalOf(userId: number, window: OtpAttemptWindow): Promise<OtpInvalidError | OtpLockedError> {
    const open = await this.tokens.findOpenOtp(userId, window);
    return open === undefined ? new OtpInvalidError() : new OtpLockedError();
  }
}
