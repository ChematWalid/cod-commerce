import { IMPORT_MAX_BYTES, IMPORT_MAX_CELL_CHARS, IMPORT_MAX_COLUMNS, type ImportJobStatus } from '@cod/shared';

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

/** Products an export reads at once; progress is written after each batch (D2211). */
export const EXPORT_READ_BATCH = 25;
/** Progress of a job, as a percentage. */
export const PROGRESS_DONE = 100;
/** The base name of an export's download, followed by `-<exportId>.<extension>` (D2208: no store or product text). */
export const EXPORT_DOWNLOAD_BASE = 'products';

/** Longest CSV record csv-parse accepts: every column at the cell cap (D2222). */
export const IMPORT_MAX_RECORD_CHARS = IMPORT_MAX_COLUMNS * IMPORT_MAX_CELL_CHARS;
/**
 * Characters a reader may yield from one sheet, every cell counted (D2269): as many as the largest upload holds bytes,
 * so a CSV never reaches it, while an xlsx whose cells repeat one shared string cannot multiply its text.
 */
export const IMPORT_MAX_SHEET_CHARS = IMPORT_MAX_BYTES;
/** SKUs one `findBySkus` call looks up while previewing: one preview page's worth (D2209). */
export const IMPORT_SKU_LOOKUP_BATCH = 200;
/** The import worker writes its progress after this many rows (D2210). */
export const IMPORT_PROGRESS_EVERY_ROWS = 50;
/** The base name of an import's error report download, followed by `-<importId>.csv` (D2208). */
export const IMPORT_ERRORS_DOWNLOAD_BASE = 'import-errors';
/** The format the per-row error report is written in (D2210). */
export const IMPORT_REPORT_FORMAT = 'csv';
/** The columns of the error report: the row's number, its reasons, then what identifies it (D2210). */
export const IMPORT_REPORT_HEADER = ['row', 'reasons', 'product_key', 'name', 'variant_sku'] as const;

/** A link import's whole fetch, DNS and every redirect hop included, ends after this long (D2214). */
export const LINK_FETCH_TIMEOUT_MS = 5_000;
/** Most bytes of a page a link import receives; the rest is never read (D2214). */
export const LINK_MAX_BYTES = 2 * 1_024 * 1_024;
/** Most wanted `<meta>` tags a page is read for; later ones are ignored, so a page of repeated metas stays cheap (D2275). */
export const PAGE_MAX_METAS = 256;
/** Most JSON-LD blocks a page is read for (D2275). */
export const PAGE_MAX_LD_BLOCKS = 32;
/** Most redirects a link import follows; each target is vetted again (D2214). */
export const LINK_MAX_REDIRECTS = 3;
/** The ports a link may name: plain HTTP and HTTPS only (D2214); tests inject another policy. */
export const LINK_PORTS = [80, 443] as const;
/** A link import is synchronous: its job row is written once, already done, with the product it made (D2214). */
export const LINK_IMPORT_STATUS: ImportJobStatus = 'done';
