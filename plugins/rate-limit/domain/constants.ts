const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86_400;

/** Failures per minute one account (or one account-and-IP pair) may cause before the bucket is empty (D29). */
export const ACCOUNT_CAPACITY = 10;
/** Requests per minute one client IP may make to an account-facing endpoint; high for shared mobile networks (D29). */
export const IP_CAPACITY = 60;
/** Sign-ups per hour from one IP (D29). */
export const REGISTER_IP_CAPACITY = 20;

/** Invitations one business may send per hour (D205: the platform must not be a mail relay). */
export const TEAM_INVITE_BUSINESS_CAPACITY = 100;
/** Invitations, or resends, one administrator may send per hour (D205). */
export const TEAM_ACTOR_MAIL_CAPACITY = 30;

/** Media uploads one business may make per hour: the shared bucket must not be filled by one business (D2138). */
export const CATALOG_MEDIA_BUSINESS_CAPACITY = 1000;
/** Media uploads one administrator may make per hour (D2138). */
export const CATALOG_MEDIA_ACTOR_CAPACITY = 120;

/** Wrong or right code guesses per day one account may make, whatever the resends (D44). */
export const OTP_DAILY_CAPACITY = 50;

export const DAY_WINDOW_SECONDS = DAY_SECONDS;
export const MINUTE_WINDOW_SECONDS = MINUTE_SECONDS;
export const HOUR_WINDOW_SECONDS = HOUR_SECONDS;

/** The first lockout of a key lasts this long; every further one doubles (D29). */
export const LOCKOUT_INITIAL_SECONDS = MINUTE_SECONDS;
/** Each lockout of a key lasts this many times the previous one. */
export const LOCKOUT_GROWTH_FACTOR = 2;
/** No lockout lasts longer than this. */
export const LOCKOUT_MAX_SECONDS = HOUR_SECONDS;
/** How long a key remembers its last lockout after it ended, so a repeat offender keeps doubling. */
export const LOCKOUT_MEMORY_SECONDS = HOUR_SECONDS;

export const MS_PER_SECOND = 1000;

/** The GraphQL `extensions.code` of an over-limit answer (D30). */
export const RATE_LIMITED_CODE = 'RATE_LIMITED';

/** Valkey key prefix of every limiter key. */
export const KEY_PREFIX = 'rl';

/** What the limiter keys a request by when the client address cannot be read at all. */
export const UNKNOWN_CLIENT = 'unknown';
