import { OTP_LENGTH, QUEUES } from '@cod/shared';

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

/** The worker queue of the account emails (D42), a critical queue of the registry (D98). */
export const AUTH_EMAIL_QUEUE = 'auth-email' satisfies keyof typeof QUEUES;

/** Delivery attempts per email, from the queue registry: the first try and four retries (D98). */
export const AUTH_EMAIL_ATTEMPTS = QUEUES[AUTH_EMAIL_QUEUE].attempts;

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

/** Authenticated context of a sealed `state`: a value sealed for the mail queue does not open as one, nor the reverse. */
export const OAUTH_STATE_SEAL_CONTEXT = 'oauth-state';

/** How long a browser may stay at the provider before its `state` stops working. */
export const OAUTH_STATE_TTL_MS = 600_000;

/** The browser binding cookie (D36). It outlives `state` by the ticket's five minutes, so the ticket can be checked. */
export const OAUTH_BINDING_COOKIE = 'cod_oauth_binding';
export const OAUTH_BINDING_COOKIE_MAX_AGE_MS = 900_000;

/** How long a provider may take to answer one server-side request. */
export const OAUTH_HTTP_TIMEOUT_MS = 5000;

/** Random bytes of a PKCE code verifier before base64url. */
export const OAUTH_PKCE_VERIFIER_BYTES = 32;

/** The name of the login strategy, and the key of its `authenticate` input. */
export const OAUTH_STRATEGY_NAME = 'oauth';

/** The dashboard page that spends a sign-in ticket, and shows a refused sign-in (D36). */
export const OAUTH_COMPLETE_PATH = '/oauth-complete';

/** The dashboard page where a new identity finishes signing up (D36). */
export const OAUTH_REGISTER_PATH = '/register';

/** How long the challenge provider may take before sign-up goes on without it (D35). */
export const CHALLENGE_TIMEOUT_MS = 3000;

/** i18n key of the refused login (D30): the stock login form shows the message, so it must be translated. */
export const LOGIN_RATE_LIMITED_MESSAGE = 'error.auth-login-rate-limited';

/** i18n key of a profile update that must go through the account security flows (D38). */
export const USE_ACCOUNT_SECURITY_MESSAGE = 'error.auth-use-account-security';
