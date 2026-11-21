/** Most data rows one import reads (D2209). */
export const IMPORT_MAX_ROWS = 5_000;
/** Largest uploaded file, compressed: 10 MiB (D2208). */
export const IMPORT_MAX_BYTES = 10_485_760;

/** Parser limits checked before exceljs or csv-parse run (D2222). */
export const IMPORT_MAX_UNCOMPRESSED_BYTES = 52_428_800;
export const IMPORT_MAX_ZIP_RATIO = 100;
export const IMPORT_MAX_ZIP_ENTRIES = 200;
export const IMPORT_MAX_COLUMNS = 64;
export const IMPORT_MAX_CELL_CHARS = 10_000;
/** Cooperative deadline of analyze and preview, checked between rows. */
export const IMPORT_PARSE_DEADLINE_MS = 20_000;
/** The header row is looked for in this many first rows. */
export const IMPORT_HEADER_WINDOW_ROWS = 10;

/** Most preview rows one page answers (D2210). */
export const IMPORT_PREVIEW_PAGE_MAX = 200;
/** Most image links one row carries, and the longest one (D2209). */
export const IMPORT_MAX_IMAGE_URLS = 10;
export const IMPORT_MAX_URL_CHARS = 2_048;
/** Separator of the list cells (`tags`, `image_urls`). */
export const IMPORT_LIST_SEPARATOR = ';';

/** Up to this many rows (one per variant) an export is written at once; above, it is a job on `imports-exports` (D2211, D2259). */
export const EXPORT_SYNC_MAX_ROWS = 500;
/** Most rows (one per variant) one export writes, and most products a filter may find; above, `catalog-import.too-many-rows` (D2259). */
export const EXPORT_MAX_ROWS = 20_000;
/** Most products one bulk edit changes (D2213). */
export const BULK_EDIT_MAX_PRODUCTS = 500;
/** Bounds of a bulk percentage price change. */
export const BULK_EDIT_PERCENT_MIN = -100;
export const BULK_EDIT_PERCENT_MAX = 1000;

/** Lifetime of a presigned upload and of a presigned download (D2208). */
export const UPLOAD_URL_TTL_SECONDS = 600;
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/** Spreadsheet formats; each is one adapter of the format registry (D2209). */
export const IMPORT_FORMATS = ['xlsx', 'csv'] as const;
/** One of the {@link IMPORT_FORMATS}. */
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** The content type a file of each format is uploaded and downloaded with. */
export const IMPORT_CONTENT_TYPE_OF_FORMAT = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
} as const satisfies Record<ImportFormat, string>;
/** One of the content types of {@link IMPORT_CONTENT_TYPE_OF_FORMAT}. */
export type ImportContentType = (typeof IMPORT_CONTENT_TYPE_OF_FORMAT)[ImportFormat];
/** Content types an upload may declare; frozen, so the schemas and their readers keep one list. */
export const IMPORT_CONTENT_TYPES: readonly ImportContentType[] = Object.freeze(
  IMPORT_FORMATS.map((format) => IMPORT_CONTENT_TYPE_OF_FORMAT[format]),
);

/** Lifecycle of an import job (D2210). */
export const IMPORT_JOB_STATUSES = [
  'awaiting_upload',
  'analyzed',
  'previewed',
  'confirming',
  'running',
  'done',
  'failed',
] as const;
/** Kinds of import job: a spreadsheet, or one product from a link (D2210, D2214). */
export const IMPORT_JOB_KINDS = ['spreadsheet', 'link'] as const;
/** What confirming a preview row does. */
export const IMPORT_ROW_ACTIONS = ['create', 'update', 'error'] as const;
/** Lifecycle of an export job (D2211). */
export const EXPORT_JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
/** Which products an export writes: the selected ids, or every product the list's query finds. */
export const EXPORT_SCOPES = ['selected', 'filtered'] as const;
/** Where a product came from (D2210). */
export const PRODUCT_SOURCES = ['manual', 'import', 'link'] as const;
/** How a bulk edit changes prices (D2213). */
export const BULK_EDIT_PRICE_MODES = ['percent', 'amount', 'fixed'] as const;
/** Fields a bulk edit records as changed in the activity log. */
export const BULK_EDIT_CHANGED_FIELDS = ['status', 'brand', 'tags', 'price'] as const;

/** Handler kinds of the `imports-exports` queue (D2212); P4.S2 appends order exports. */
export const IMPORTS_EXPORTS_JOB_KINDS = {
  productImport: 'product-import',
  productExport: 'product-export',
} as const;

/** One of the {@link IMPORT_JOB_STATUSES}. */
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];
/** One of the {@link IMPORT_JOB_KINDS}. */
export type ImportJobKind = (typeof IMPORT_JOB_KINDS)[number];
/** One of the {@link IMPORT_ROW_ACTIONS}. */
export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];
/** One of the {@link EXPORT_JOB_STATUSES}. */
export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];
/** One of the {@link EXPORT_SCOPES}. */
export type ExportScope = (typeof EXPORT_SCOPES)[number];
/** One of the {@link PRODUCT_SOURCES}. */
export type ProductSource = (typeof PRODUCT_SOURCES)[number];
/** One of the {@link BULK_EDIT_PRICE_MODES}. */
export type BulkEditPriceMode = (typeof BULK_EDIT_PRICE_MODES)[number];
/** One of the {@link BULK_EDIT_CHANGED_FIELDS}. */
export type BulkEditChangedField = (typeof BULK_EDIT_CHANGED_FIELDS)[number];
/** One of the {@link IMPORTS_EXPORTS_JOB_KINDS} values. */
export type ImportsExportsJobKind = (typeof IMPORTS_EXPORTS_JOB_KINDS)[keyof typeof IMPORTS_EXPORTS_JOB_KINDS];
