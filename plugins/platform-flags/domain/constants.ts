/** How long a process keeps a snapshot before it asks Valkey or the database again (D116). Cache policy, not env. */
export const FLAG_SNAPSHOT_TTL_MS = 30_000;

/** How long Valkey keeps the shared snapshot (D116). */
export const FLAG_VALKEY_TTL_SECONDS = 86_400;

/** The second delete and publish after a committed change, for a reader that cached the old snapshot in between (D116). */
export const FLAG_REDELETE_DELAY_MS = 500;

/** A Valkey command that takes longer is treated as a Valkey fault and the database answers instead. */
export const FLAG_VALKEY_COMMAND_TIMEOUT_MS = 250;

/** Valkey faults are logged at most this often. */
export const FLAG_VALKEY_ERROR_LOG_INTERVAL_MS = 30_000;

/** Suffixes of the Valkey names; the prefix is `APP_ENV`. */
export const FLAG_SNAPSHOT_KEY_SUFFIX = 'flags:snapshot';
export const FLAG_INVALIDATE_CHANNEL_SUFFIX = 'flags:invalidate';

/** Column and input limits. */
export const FLAG_KEY_MAX_LENGTH = 100;
export const FLAG_DESCRIPTION_MAX_LENGTH = 200;
export const OVERRIDE_SCOPE_MAX_LENGTH = 16;
export const OVERRIDE_SCOPE_ID_MAX_LENGTH = 64;
export const UPDATED_BY_MAX_LENGTH = 64;
export const ROLLOUT_MIN_PERCENT = 0;
export const ROLLOUT_MAX_PERCENT = 100;

/** A business or store id: a decimal snowflake, at most 19 digits. */
export const SNOWFLAKE_PATTERN = /^[1-9][0-9]{0,18}$/;

/** The Vendure logger context of this plugin. */
export const FLAGS_LOG_CONTEXT = 'PlatformFlagsPlugin';
