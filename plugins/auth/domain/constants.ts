import { OTP_LENGTH } from '@cod/shared';

/** Random bytes of an account token before base64url (D25). */
export const ACCOUNT_TOKEN_BYTES = 32;

/** How many distinct codes {@link OTP_LENGTH} digits can hold. */
export const OTP_SPACE = 10 ** OTP_LENGTH;

/** Hex characters of a stored HMAC-SHA-256. */
export const SECRET_HASH_LENGTH = 64;

/** Longest `account_token.purpose`. */
export const ACCOUNT_TOKEN_PURPOSE_MAX_LENGTH = 32;

/** Longest `account_token.pendingEmail`: Vendure's identifier column holds 255 characters too. */
export const PENDING_EMAIL_MAX_LENGTH = 255;

/** The largest Postgres `int`: the type of Vendure's auto-increment ids and of `account_token.userId`. */
export const ACCOUNT_USER_ID_MAX = 2_147_483_647;

/** Longest `Administrator.customFields.phone`. */
export const ADMINISTRATOR_PHONE_MAX_LENGTH = 20;

/** Length of `Administrator.customFields.emailLocale`. */
export const EMAIL_LOCALE_LENGTH = 2;

/** How long one session cache delete may take; a cache that hangs must not hold up a logout. */
export const SESSION_CACHE_DELETE_TIMEOUT_MS = 1000;

const DAY_MS = 86_400_000;

/** Finished tokens stay this long after expiry or consumption, then the purge removes them (D43). */
export const ACCOUNT_TOKEN_RETENTION_MS = 7 * DAY_MS;

/** The worker queue of the account emails (D42). P1.S6's queue registry adopts the name. */
export const AUTH_EMAIL_QUEUE = 'auth-email';

/** Delivery attempts per email: the first try and four retries. */
export const AUTH_EMAIL_ATTEMPTS = 5;

/** Domain separator of the recipient hash in logs. */
export const RECIPIENT_HASH_DOMAIN = 'recipient:';

/** Domain separator of the account key in login throttling. */
export const LOGIN_THROTTLE_HASH_DOMAIN = 'login-throttle:';

/** Characters of the recipient hash that appear in logs: enough to correlate, too short to look an address up. */
export const RECIPIENT_HASH_LENGTH = 16;

/** The dashboard page a verification link opens (D20). */
export const VERIFY_EMAIL_PATH = '/verify-email';

/** The stock dashboard page a password reset link opens (D20). */
export const RESET_PASSWORD_PATH = '/reset-password';

/** The dashboard page an email change confirmation link opens (D20). */
export const CONFIRM_EMAIL_CHANGE_PATH = '/confirm-email-change';

/** How long the challenge provider may take before sign-up goes on without it (D35). */
export const CHALLENGE_TIMEOUT_MS = 3000;

/** i18n key of the refused login (D30): the stock login form shows the message, so it must be translated. */
export const LOGIN_RATE_LIMITED_MESSAGE = 'error.auth-login-rate-limited';

/** i18n key of a profile update that must go through the account security flows (D38). */
export const USE_ACCOUNT_SECURITY_MESSAGE = 'error.auth-use-account-security';
