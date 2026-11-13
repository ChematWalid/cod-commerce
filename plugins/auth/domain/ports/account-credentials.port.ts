import type { OperationContext } from './operation-context';

/** The password of an account's native login. */
export interface AccountPasswordsPort {
  /** Whether `password` is the account's current one; `false` for an account with no password. */
  verify(ctx: OperationContext, userId: number, password: string): Promise<boolean>;
  /** Replaces the password with no check of the old one: the caller has proven ownership another way. */
  set(ctx: OperationContext, userId: number, password: string): Promise<void>;
  /**
   * Replaces the password with a random one nobody is told, so native login fails until a reset sets a new one. An
   * account with no password login is left as it is.
   */
  voidPassword(ctx: OperationContext, userId: number): Promise<void>;
  /**
   * Replaces the password after checking the current one.
   *
   * @throws CurrentPasswordWrongError or PasswordPolicyError; nothing is written.
   */
  change(ctx: OperationContext, userId: number, currentPassword: string, newPassword: string): Promise<void>;
}

/** A session just opened for an account. `channels` is the engine's `CurrentUser.channels`. */
export interface OpenedSession {
  readonly token: string;
  readonly id: string;
  readonly identifier: string;
  readonly channels: readonly object[];
}

/** Opening a session without the throttled login path. */
export interface AccountSessionsPort {
  open(ctx: OperationContext, userId: number): Promise<OpenedSession>;
}

/** The per-account attempt limits of D29. */
export type AccountLimitPolicy = 'reset-account' | 'otp-account' | 'otp-account-daily' | 'current-password-account';

/** Limits the account flows put on one account. */
export interface AccountThrottlePort {
  /** @throws a rate-limit error once the email's bucket is empty; known and unknown emails alike. */
  spendForEmail(policy: AccountLimitPolicy, email: string): Promise<void>;
  /** @throws a rate-limit error once the user's bucket is empty. */
  spendForUser(policy: AccountLimitPolicy, userId: number): Promise<void>;
  /** Forgets the login lockout of this email from the caller's address (D29). */
  clearLoginLockout(ctx: OperationContext, email: string): Promise<void>;
}
