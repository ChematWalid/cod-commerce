/** Fewest UTF-8 bytes a password may have. */
export const PASSWORD_MIN_BYTES = 8;
/** Most UTF-8 bytes a password may have: bcrypt ignores everything after 72. */
export const PASSWORD_MAX_BYTES = 72;

/** Digits in an email verification code. */
export const OTP_LENGTH = 6;
/** Wrong guesses allowed before the code locks until a resend. */
export const OTP_MAX_ATTEMPTS = 5;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** How long a verification code works. */
export const OTP_TTL_MS = 10 * MINUTE_MS;
/** Minimum wait between two verification emails. */
export const RESEND_COOLDOWN_MS = 60 * SECOND_MS;
/** How long an email verification link works. */
export const VERIFY_LINK_TTL_MS = 24 * HOUR_MS;
/** How long a password reset link works. */
export const RESET_TOKEN_TTL_MS = HOUR_MS;
/** How long an email change confirmation link works. */
export const EMAIL_CHANGE_TTL_MS = 24 * HOUR_MS;
/** How long the single-use ticket that follows an OAuth callback works. */
export const OAUTH_TICKET_TTL_MS = 5 * MINUTE_MS;

/** Largest accepted business logo, in bytes (5 MiB). */
export const LOGO_MAX_BYTES = 5_242_880;

/** Vendure `authOptions.sessionDuration`. */
export const SESSION_DURATION = '30d';

/** Longest opaque client-supplied token (challenge response, OAuth ticket) the server will read. */
export const AUTH_OPAQUE_TOKEN_MAX_LENGTH = 4096;
