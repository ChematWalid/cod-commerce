import { z } from 'zod';
import {
  CATALOG_ID_MAX_LENGTH,
  MAX_PRODUCT_COLLECTIONS,
  MAX_PRODUCT_TAGS,
  PRODUCT_STATUSES,
} from '../catalog/constants';
import { catalogObject, catalogRefIdKey, catalogRefIdListSchema, catalogRefIdSchema } from '../catalog/fields';
import { productListQuerySchema } from '../catalog/list-query';
import { MONEY_MAX_DZD, moneySchema } from '../catalog/money';
import { hasBidiControl, hasControlCharacter } from '../text/control-characters';
import {
  BULK_EDIT_CHANGED_FIELDS,
  BULK_EDIT_MAX_PRODUCTS,
  BULK_EDIT_PERCENT_MAX,
  BULK_EDIT_PERCENT_MIN,
  EXPORT_SYNC_MAX_ROWS,
  IMPORT_CONTENT_TYPE_OF_FORMAT,
  IMPORT_CONTENT_TYPES,
  IMPORT_FORMATS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_COLUMNS,
  IMPORT_MAX_ROWS,
  IMPORT_MAX_URL_CHARS,
  IMPORT_PREVIEW_PAGE_MAX,
} from './constants';
import { CATALOG_IMPORT_ERROR_CODES } from './error-codes';
import { IMPORT_FIELD_KEY_ENUM, IMPORT_FIELD_KEYS } from './fields';

const invalidImportInput = { message: CATALOG_IMPORT_ERROR_CODES.INVALID_INPUT };
const LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

const hasNoRepeat = (values: readonly unknown[]): boolean => new Set(values).size === values.length;

/** Ids as the boundary will parse them, each once, in first-seen order ("01" and "1" are one id). */
function dedupeIds(ids: readonly string[]): string[] {
  const firstByKey = new Map<string, string>();
  for (const id of ids) if (!firstByKey.has(catalogRefIdKey(id))) firstByKey.set(catalogRefIdKey(id), id);
  return [...firstByKey.values()];
}

/** Between `min` and `max` referenced ids; repeats are dropped, not refused (D2211, D2213). */
function dedupedIdListSchema(min: number, max: number) {
  return z
    .array(catalogRefIdSchema, invalidImportInput)
    .min(min, invalidImportInput)
    .max(max, invalidImportInput)
    .transform(dedupeIds);
}

const wholeNumber = z.number(invalidImportInput).int(invalidImportInput);

/** A bulk price change (D2213): a percentage, a signed amount in whole DZD, or a fixed price. */
const priceChangeSchema = z.discriminatedUnion(
  'mode',
  [
    catalogObject({
      mode: z.literal('percent'),
      value: z
        .number(invalidImportInput)
        .min(BULK_EDIT_PERCENT_MIN, invalidImportInput)
        .max(BULK_EDIT_PERCENT_MAX, invalidImportInput),
    }),
    catalogObject({
      mode: z.literal('amount'),
      value: wholeNumber.min(-MONEY_MAX_DZD, invalidImportInput).max(MONEY_MAX_DZD, invalidImportInput),
    }),
    catalogObject({ mode: z.literal('fixed'), value: moneySchema }),
  ],
  invalidImportInput,
);

const bulkChangesSchema = catalogObject({
  status: z.enum(PRODUCT_STATUSES, invalidImportInput).optional(),
  brandId: catalogRefIdSchema.nullish(),
  addTagIds: dedupedIdListSchema(1, MAX_PRODUCT_TAGS).optional(),
  removeTagIds: dedupedIdListSchema(1, MAX_PRODUCT_TAGS).optional(),
  collectionIds: catalogRefIdListSchema(MAX_PRODUCT_COLLECTIONS).optional(),
  price: priceChangeSchema.optional(),
}).refine(
  (changes) => Object.values(changes as Record<string, unknown>).some((value) => value !== undefined),
  invalidImportInput,
);

/**
 * "Bulk edit" of selected products (D2213): 1 to 500 ids (repeats dropped) and at least one change; `brandId: null`
 * clears the brand. `collectionIds` is accepted by shape and refused by the service until P2.S3. `dryRun` answers
 * the same summary and writes nothing.
 */
export const bulkEditInputSchema = catalogObject({
  productIds: dedupedIdListSchema(1, BULK_EDIT_MAX_PRODUCTS),
  changes: bulkChangesSchema,
  dryRun: z.boolean(invalidImportInput).default(false),
});

export type BulkEditInput = z.input<typeof bulkEditInputSchema>;
export type BulkEditCommand = z.output<typeof bulkEditInputSchema>;
export type BulkPriceChange = z.output<typeof priceChangeSchema>;

/** The diff of one product's bulk-edit activity row: the fields that changed, each once. */
export const productBulkEditDiffSchema = catalogObject({
  changedFields: z
    .array(z.enum(BULK_EDIT_CHANGED_FIELDS, invalidImportInput), invalidImportInput)
    .min(1, invalidImportInput)
    .refine(hasNoRepeat, invalidImportInput),
});

export type ProductBulkEditDiff = z.output<typeof productBulkEditDiffSchema>;

const formatSchema = z.enum(IMPORT_FORMATS, invalidImportInput);
const exportFieldsSchema = z
  .array(z.enum(IMPORT_FIELD_KEY_ENUM, invalidImportInput), invalidImportInput)
  .min(1, invalidImportInput)
  .max(IMPORT_FIELD_KEYS.length, invalidImportInput)
  .refine(hasNoRepeat, invalidImportInput)
  .optional();

/**
 * "Export products" (D2211): the selected ids (at most the synchronous cap, repeats dropped) or every product the
 * list's query finds; optionally only some columns, in export order whatever the order given.
 */
export const exportInputSchema = z.discriminatedUnion(
  'scope',
  [
    catalogObject({
      scope: z.literal('selected'),
      format: formatSchema,
      productIds: dedupedIdListSchema(1, EXPORT_SYNC_MAX_ROWS),
      fields: exportFieldsSchema,
    }),
    catalogObject({
      scope: z.literal('filtered'),
      format: formatSchema,
      query: productListQuerySchema,
      fields: exportFieldsSchema,
    }),
  ],
  invalidImportInput,
);

export type ExportInput = z.input<typeof exportInputSchema>;
export type ExportCommand = z.output<typeof exportInputSchema>;

/**
 * "Upload a spreadsheet" (D2208): the format, the exact size in bytes (signed into the presigned PUT) and the
 * format's own content type.
 */
export const uploadInputSchema = catalogObject({
  format: formatSchema,
  size: wholeNumber.min(1, invalidImportInput).max(IMPORT_MAX_BYTES, invalidImportInput),
  contentType: z.enum(IMPORT_CONTENT_TYPES, invalidImportInput),
}).refine(({ format, contentType }) => IMPORT_CONTENT_TYPE_OF_FORMAT[format] === contentType, invalidImportInput);

export type UploadInput = z.input<typeof uploadInputSchema>;
export type UploadCommand = z.output<typeof uploadInputSchema>;

/** The import job id a step acts on; a malformed one answers not found at the boundary (D2136). */
const importIdSchema = z.string(invalidImportInput).max(CATALOG_ID_MAX_LENGTH, invalidImportInput);

/** "Analyze the uploaded file" of an import job (D2210). */
export const analyzeInputSchema = catalogObject({ importId: importIdSchema });

export type AnalyzeCommand = z.output<typeof analyzeInputSchema>;

const columnMappingSchema = catalogObject({
  column: wholeNumber.min(0, invalidImportInput).max(IMPORT_MAX_COLUMNS - 1, invalidImportInput),
  field: z.enum(IMPORT_FIELD_KEY_ENUM, invalidImportInput).nullable(),
});

type ColumnMapping = z.output<typeof columnMappingSchema>;

/** Each column named once, and each field taken by one column at most (`null` leaves a column unmapped). */
const isOneToOne = (mapping: readonly ColumnMapping[]): boolean =>
  hasNoRepeat(mapping.map(({ column }) => column)) &&
  hasNoRepeat(mapping.flatMap(({ field }) => (field === null ? [] : [field])));

/** A merchant's override of the detected column mapping; the preview is recomputed with it (D2210). */
export const previewMappingSchema = catalogObject({
  mapping: z
    .array(columnMappingSchema, invalidImportInput)
    .max(IMPORT_MAX_COLUMNS, invalidImportInput)
    .refine(isOneToOne, invalidImportInput),
});

export type PreviewMappingCommand = z.output<typeof previewMappingSchema>;

/** A page of an import's preview rows: at most {@link IMPORT_PREVIEW_PAGE_MAX}; may come as a query string. */
export const importPreviewQuerySchema = catalogObject({
  skip: z.coerce
    .number(invalidImportInput)
    .int(invalidImportInput)
    .min(0, invalidImportInput)
    .max(IMPORT_MAX_ROWS, invalidImportInput)
    .default(0),
  take: z.coerce
    .number(invalidImportInput)
    .int(invalidImportInput)
    .min(1, invalidImportInput)
    .max(IMPORT_PREVIEW_PAGE_MAX, invalidImportInput)
    .default(IMPORT_PREVIEW_PAGE_MAX),
});

export type ImportPreviewQuery = z.output<typeof importPreviewQuerySchema>;

/** True for an absolute `http:` or `https:` URL; the SSRF guard decides the rest server-side (D2214). */
function isHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  return LINK_PROTOCOLS.has(new URL(value).protocol);
}

/** "Import a product from a link" (D2214): one http(s) URL of at most 2 048 characters. */
export const linkImportInputSchema = catalogObject({
  url: z
    .string(invalidImportInput)
    .trim()
    .min(1, invalidImportInput)
    .max(IMPORT_MAX_URL_CHARS, invalidImportInput)
    .refine((value) => !hasControlCharacter(value) && !hasBidiControl(value), invalidImportInput)
    .refine(isHttpUrl, invalidImportInput),
});

export type LinkImportCommand = z.output<typeof linkImportInputSchema>;
