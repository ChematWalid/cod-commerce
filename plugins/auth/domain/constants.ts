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

/** Longest `Administrator.customFields.phone`. */
export const ADMINISTRATOR_PHONE_MAX_LENGTH = 20;

/** Length of `Administrator.customFields.emailLocale`. */
export const EMAIL_LOCALE_LENGTH = 2;

const DAY_MS = 86_400_000;

/** Finished tokens stay this long after expiry or consumption, then the purge removes them (D43). */
export const ACCOUNT_TOKEN_RETENTION_MS = 7 * DAY_MS;

/** The worker queue of the account emails (D42). P1.S6's queue registry adopts the name. */
export const AUTH_EMAIL_QUEUE = 'auth-email';

/** Delivery attempts per email: the first try and four retries. */
export const AUTH_EMAIL_ATTEMPTS = 5;

/** Characters of the recipient hash that appear in logs: enough to correlate, too short to look an address up. */
export const RECIPIENT_HASH_LENGTH = 16;
