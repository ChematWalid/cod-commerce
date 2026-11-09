/** Why an account token exists. Only `oauth-ticket` may lack a user: a new identity has no `User` yet. */
export const ACCOUNT_TOKEN_PURPOSES = ['email-verification', 'password-reset', 'email-change', 'oauth-ticket'] as const;

/** One of the {@link ACCOUNT_TOKEN_PURPOSES}. */
export type AccountTokenPurpose = (typeof ACCOUNT_TOKEN_PURPOSES)[number];

/** The purpose whose tokens carry the emailed one-time code. */
export const OTP_PURPOSE: AccountTokenPurpose = 'email-verification';

/** The purpose whose tokens have no user. */
export const USERLESS_PURPOSE: AccountTokenPurpose = 'oauth-ticket';

/** Data an OAuth ticket carries to the end of sign-up. */
export type AccountTokenPayload = Readonly<Record<string, unknown>>;

/** A row of `account_token` (D24: account-level, not tenant-scoped). It only ever holds hashes of the secrets. */
export interface AccountToken {
  readonly id: string;
  readonly userId: number | null;
  readonly purpose: AccountTokenPurpose;
  readonly tokenHash: string;
  readonly otpHash: string | null;
  readonly otpAttempts: number;
  readonly otpLockedAt: Date | null;
  readonly pendingEmail: string | null;
  readonly payload: AccountTokenPayload | null;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

/** The fields of a token about to be stored; the rest start empty. */
export type NewAccountToken = Pick<
  AccountToken,
  'id' | 'userId' | 'purpose' | 'tokenHash' | 'otpHash' | 'pendingEmail' | 'payload' | 'expiresAt' | 'createdAt'
>;

/** Which code a guess may be counted against. */
export interface OtpAttemptWindow {
  readonly now: Date;
  /** The code works for `OTP_TTL_MS` from issue, while the link in the same row lasts longer (D26). */
  readonly issuedAfter: Date;
  readonly maxAttempts: number;
}
