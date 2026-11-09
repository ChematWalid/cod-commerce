import type { AccountToken, AccountTokenPurpose, NewAccountToken, OtpAttemptWindow } from '../account-token';
import type { OperationContext } from './operation-context';

/** Storage of `account_token`. Every state change is a single conditional write, safe under concurrency. */
export interface AccountTokenRepositoryPort {
  /** Stores `token` and voids the user's open tokens of that purpose, atomically; concurrent calls serialize. */
  replaceOpen(ctx: OperationContext, token: NewAccountToken): Promise<void>;

  /** Marks the open, unexpired token with this hash used. `undefined` when no such token, or another caller won. */
  consumeByHash(
    ctx: OperationContext,
    purpose: AccountTokenPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<AccountToken | undefined>;

  /**
   * Counts one guess against the user's open code, locking it on the last allowed one, and returns the row as
   * updated; `undefined` when no guess is left or no code is open. It takes no context on purpose: it commits by
   * itself, so a guess stays counted when the caller's transaction rolls back on the error it causes.
   */
  claimOtpAttempt(userId: number, window: OtpAttemptWindow): Promise<AccountToken | undefined>;

  /** The user's open code, locked or not, for telling "locked" from "none" once a claim was refused. */
  findOpenOtp(userId: number, window: OtpAttemptWindow): Promise<AccountToken | undefined>;

  /** Marks a token whose code was right as used and lifts the lock. `undefined` when another caller won. */
  consumeOtpToken(ctx: OperationContext, id: string, now: Date): Promise<AccountToken | undefined>;

  /** Ends the user's open tokens of these purposes. */
  voidOpen(ctx: OperationContext, userId: number, purposes: readonly AccountTokenPurpose[], now: Date): Promise<void>;

  /** When the user's latest token of this purpose was issued, voided ones included. */
  lastIssuedAt(ctx: OperationContext, userId: number, purpose: AccountTokenPurpose): Promise<Date | undefined>;
}
