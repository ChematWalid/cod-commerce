/** The longest note title, after trimming. */
export const NOTE_TITLE_MAX_LENGTH = 120;

/** The longest note body. */
export const NOTE_BODY_MAX_LENGTH = 2000;

/** How many notes a list returns when the caller does not say. */
export const DEFAULT_PAGE_SIZE = 20;

/** The most notes one list call returns, whatever the caller asks for. */
export const MAX_PAGE_SIZE = 100;

/** A note id: a positive 63-bit integer in decimal, without leading zeros (ADR 0003). */
export const NOTE_ID_FORMAT = /^[1-9][0-9]{0,18}$/;

/** The largest note id: 2^63 − 1, the maximum of a Postgres `bigint`. */
export const MAX_NOTE_ID = 9223372036854775807n;
