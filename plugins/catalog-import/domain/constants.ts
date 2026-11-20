/** The queue catalog-import defines and alone defines (D2212); P4.S2 registers order exports on it. */
export const IMPORTS_EXPORTS_QUEUE = 'imports-exports' as const;

/** One job of a business runs at a time on the queue (ADR 0013, D2212). */
export const IMPORTS_EXPORTS_BUSINESS_LIMIT = 1;

/** Fixed codes a failed job row stores; exception text is never stored (D2210). */
export const JOB_ERROR_CODES = {
  /** The payload's business or store differs from the row's. */
  SCOPE_MISMATCH: 'catalog-import.job-scope-mismatch',
  /** The store is archived or its business suspended: catalog refuses its context. */
  STORE_UNAVAILABLE: 'catalog-import.job-store-unavailable',
  /** The handler failed on its last attempt. */
  FAILED: 'catalog-import.job-failed',
  /** The row stayed `running` past {@link RUNNING_STALE_MS}: its worker died. */
  STALLED: 'catalog-import.job-stalled',
} as const;

/** One of the {@link JOB_ERROR_CODES} values. */
export type JobErrorCode = (typeof JOB_ERROR_CODES)[keyof typeof JOB_ERROR_CODES];

/** A `confirming` or `queued` row untouched this long has lost its BullMQ job: the reconciler re-enqueues it. */
export const REQUEUE_STALE_MS = 2 * 60_000;
/** A `running` row untouched this long is failed `STALLED` by the reconciler. */
export const RUNNING_STALE_MS = 30 * 60_000;

/** The bytes a sniff looks at: the first 8 KiB of the object (D2208). */
export const SNIFF_HEAD_BYTES = 8_192;

/** Width of the short word columns (status, kind, format, scope, source, error code). */
export const JOB_WORD_MAX_LENGTH = 32;
/** Width of an error code column: a message id such as `catalog-import.job-store-unavailable`. */
export const ERROR_CODE_MAX_LENGTH = 64;
/** Width of a stored ETag (quoted hex, or a multipart `"…-n"`). */
export const ETAG_MAX_LENGTH = 128;
/** Width of a stored content type. */
export const CONTENT_TYPE_MAX_LENGTH = 128;
/** Width of a stored mapping hash (sha-256 hex). */
export const MAPPING_HASH_LENGTH = 64;
