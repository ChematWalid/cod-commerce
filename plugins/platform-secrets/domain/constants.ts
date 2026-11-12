/** The longest secret value, in UTF-8 bytes (D114). */
export const SECRET_VALUE_MAX_BYTES = 4096;

/** A value of at least this many characters keeps its last four for display; a shorter one would reveal too much of itself. */
export const LAST4_MIN_CHARACTERS = 12;

/** How many trailing characters `last4` keeps. */
export const LAST4_LENGTH = 4;

/** AES-256 keys, the data keys and the key-encryption keys alike. */
export const AES_KEY_BYTES = 32;

/** AES-GCM nonce: 96 bits, as NIST SP 800-38D recommends, fresh for every seal. */
export const GCM_IV_BYTES = 12;

/** AES-GCM authentication tag: the full 128 bits. */
export const GCM_TAG_BYTES = 16;

/** A key id: 1 to 16 characters of `[a-z0-9-]`, the `varchar(16)` column of `tenant_data_key.kid`. */
export const KID_PATTERN = /^[a-z0-9-]{1,16}$/;

/** The `varchar(40)` column of `tenant_secret.provider`; a provider name is kebab-case and starts with a letter. */
export const PROVIDER_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
export const PROVIDER_MAX_LENGTH = 40;

/** The `varchar(100)` column of `tenant_secret.ref`. */
export const REF_MAX_LENGTH = 100;

/** The `varchar(4)` column of `tenant_secret.last4`. */
export const LAST4_COLUMN_LENGTH = 4;

/** A secret or data key id: a positive 63-bit integer in decimal, without leading zeros (ADR 0003). */
export const ROW_ID_FORMAT = /^[1-9][0-9]{0,18}$/;
export const MAX_ROW_ID = 9223372036854775807n;

/** Prefixes of the additional authenticated data (D114); changing one makes every stored row unreadable. */
export const DATA_KEY_AAD_LABEL = 'tenant-data-key';
export const SECRET_AAD_LABEL = 'tenant-secret';

/** The context of the plugin's log lines. */
export const SECRETS_LOG_CONTEXT = 'PlatformSecrets';
