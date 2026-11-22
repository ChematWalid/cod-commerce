const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86_400;

/** Failures per minute one account (or one account-and-IP pair) may cause before the bucket is empty (D29). */
export const ACCOUNT_CAPACITY = 10;
/** Requests per minute one client IP may make to an account-facing endpoint; high for shared mobile networks (D29). */
export const IP_CAPACITY = 60;
/**
 * Reads per minute one client IP may make of the public wilaya list (D3117): a buyer's page reads the list and a
 * wilaya or two, behind shared mobile addresses; the storefront server reads the signed route, which is not limited.
 */
export const PROVINCES_IP_CAPACITY = 120;
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

/** Live previews of a collection rule one administrator may run per minute: each one matches the whole store (D2338). */
export const COLLECTIONS_PREVIEW_ACTOR_CAPACITY = 30;
/** Reads of the collection condition builder's options one administrator may make per minute (D2338). */
export const COLLECTIONS_RULE_OPTIONS_ACTOR_CAPACITY = 30;

/** Spreadsheet import steps (upload, analyze, preview, confirm) per hour: each parses a file in the API (D2217). */
export const CATALOG_IMPORT_ACTOR_CAPACITY = 30;
export const CATALOG_IMPORT_BUSINESS_CAPACITY = 200;
/** Exports one business may start per hour; each writes a file to the private bucket (D2217). */
export const CATALOG_EXPORT_BUSINESS_CAPACITY = 120;
/** Link imports and AI polish per hour; each fetches a remote page or calls a model (D2217). */
export const CATALOG_SCRAPE_ACTOR_CAPACITY = 60;
export const CATALOG_SCRAPE_BUSINESS_CAPACITY = 300;
/** Bulk edits per hour; each may write up to 500 products (D2217). */
export const CATALOG_BULK_EDIT_ACTOR_CAPACITY = 120;
export const CATALOG_BULK_EDIT_BUSINESS_CAPACITY = 600;
/** Pack price previews one administrator may ask for per hour, as the editor recomputes (D2217). */
export const CATALOG_PACK_PREVIEW_ACTOR_CAPACITY = 600;

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
