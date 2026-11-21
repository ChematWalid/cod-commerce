import { describe, expect, it } from 'vitest';
import {
  BULK_EDIT_MAX_PRODUCTS,
  CATALOG_IMPORT_ERROR_CODES,
  CATALOG_IMPORT_ROW_ERRORS,
  CATALOG_IMPORT_ROW_REASONS,
  CATALOG_IMPORT_ROW_WARNINGS,
  DOWNLOAD_URL_TTL_SECONDS,
  EXPORT_JOB_STATUSES,
  EXPORT_MAX_ROWS,
  EXPORT_SYNC_MAX_ROWS,
  IMPORT_CONTENT_TYPES,
  IMPORT_FORMATS,
  IMPORT_JOB_STATUSES,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_COLUMNS,
  IMPORT_MAX_ROWS,
  IMPORT_PREVIEW_PAGE_MAX,
  PRODUCT_SOURCES,
  UPLOAD_URL_TTL_SECONDS,
  analyzeInputSchema,
  bulkEditInputSchema,
  exportInputSchema,
  importPreviewQuerySchema,
  linkImportInputSchema,
  previewMappingSchema,
  productBulkEditDiffSchema,
  uploadInputSchema,
} from '../../src/index';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const idsOf = (count: number) => Array.from({ length: count }, (_, index) => String(index + 1));

describe('import and export constants', () => {
  it('pins the caps, TTLs, formats and statuses', () => {
    expect([IMPORT_MAX_ROWS, IMPORT_MAX_BYTES, EXPORT_SYNC_MAX_ROWS, EXPORT_MAX_ROWS]).toEqual([
      5_000, 10_485_760, 500, 20_000,
    ]);
    expect([BULK_EDIT_MAX_PRODUCTS, UPLOAD_URL_TTL_SECONDS, DOWNLOAD_URL_TTL_SECONDS]).toEqual([500, 600, 300]);
    expect(IMPORT_FORMATS).toEqual(['xlsx', 'csv']);
    expect(IMPORT_CONTENT_TYPES).toEqual([XLSX_TYPE, 'text/csv']);
    expect(IMPORT_JOB_STATUSES).toEqual([
      'awaiting_upload',
      'analyzed',
      'previewed',
      'confirming',
      'running',
      'done',
      'failed',
    ]);
    expect(EXPORT_JOB_STATUSES).toEqual(['queued', 'running', 'done', 'failed']);
    expect(PRODUCT_SOURCES).toEqual(['manual', 'import', 'link']);
  });

  it('prefixes every error and row reason with catalog-import.', () => {
    const codes = [...Object.values(CATALOG_IMPORT_ERROR_CODES), ...Object.values(CATALOG_IMPORT_ROW_REASONS)];

    for (const code of codes) expect(code).toMatch(/^catalog-import\.[a-z]+(-[a-z]+)*$/);
    expect(new Set(Object.values(CATALOG_IMPORT_ERROR_CODES)).size).toBe(16);
  });

  it('keeps row errors and warnings apart, both in the row reasons', () => {
    const errors: readonly string[] = Object.values(CATALOG_IMPORT_ROW_ERRORS);
    const warnings: readonly string[] = Object.values(CATALOG_IMPORT_ROW_WARNINGS);

    expect(errors.filter((code) => warnings.includes(code))).toEqual([]);
    expect(Object.values(CATALOG_IMPORT_ROW_REASONS).sort()).toEqual([...errors, ...warnings].sort());
    expect(errors).toContain(CATALOG_IMPORT_ERROR_CODES.ROW_PRODUCT_NOT_FOUND);
    expect(errors).toContain(CATALOG_IMPORT_ERROR_CODES.ROW_SKU_TAKEN);
    expect(errors).toContain(CATALOG_IMPORT_ERROR_CODES.UPDATE_FORBIDDEN);
  });
});

describe('bulkEditInputSchema (D2213)', () => {
  const statusChange = { status: 'hidden' } as const;

  it('accepts 500 product ids and dedupes repeats', () => {
    // Act
    const parsed = bulkEditInputSchema.parse({ productIds: ['1', '01', '2'], changes: statusChange });

    // Assert
    expect(parsed.productIds).toEqual(['1', '2']);
    expect(parsed.dryRun).toBe(false);
    expect(bulkEditInputSchema.safeParse({ productIds: idsOf(500), changes: statusChange }).success).toBe(true);
  });

  it('refuses 501 product ids', () => {
    expect(bulkEditInputSchema.safeParse({ productIds: idsOf(501), changes: statusChange }).success).toBe(false);
  });

  it('caps the ids after dropping repeats, and the raw list at twice the cap', () => {
    // Arrange
    const repeated = Array.from({ length: BULK_EDIT_MAX_PRODUCTS + 1 }, () => '1');
    const huge = Array.from({ length: 2 * BULK_EDIT_MAX_PRODUCTS + 1 }, () => '1');

    // Act
    const parsed = bulkEditInputSchema.safeParse({ productIds: repeated, changes: statusChange });
    const refused = bulkEditInputSchema.safeParse({ productIds: huge, changes: statusChange });

    // Assert
    expect(parsed.success && parsed.data.productIds).toEqual(['1']);
    expect(refused.success).toBe(false);
  });

  it('refuses a tag both added and removed, compared as the boundary parses ids', () => {
    // Act
    const parsed = bulkEditInputSchema.safeParse({
      productIds: ['1'],
      changes: { addTagIds: ['5'], removeTagIds: ['05'] },
    });

    // Assert
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(CATALOG_IMPORT_ERROR_CODES.INVALID_INPUT);
  });

  it('refuses no product and no change', () => {
    expect(bulkEditInputSchema.safeParse({ productIds: [], changes: statusChange }).success).toBe(false);
    expect(bulkEditInputSchema.safeParse({ productIds: ['1'], changes: {} }).success).toBe(false);
  });

  it('accepts collectionIds by shape (the service refuses it, D2213)', () => {
    expect(bulkEditInputSchema.safeParse({ productIds: ['1'], changes: { collectionIds: ['5'] } }).success).toBe(true);
  });

  it('refuses price percent -101', () => {
    const changes = (value: number) => ({ price: { mode: 'percent', value } });

    expect(bulkEditInputSchema.safeParse({ productIds: ['1'], changes: changes(-101) }).success).toBe(false);
    expect(bulkEditInputSchema.safeParse({ productIds: ['1'], changes: changes(-100) }).success).toBe(true);
    expect(bulkEditInputSchema.safeParse({ productIds: ['1'], changes: changes(1001) }).success).toBe(false);
  });

  it('takes an amount of whole DZD either way and a fixed price within money bounds', () => {
    const parse = (price: unknown) => bulkEditInputSchema.safeParse({ productIds: ['1'], changes: { price } }).success;

    expect(parse({ mode: 'amount', value: -500 })).toBe(true);
    expect(parse({ mode: 'amount', value: 2.5 })).toBe(false);
    expect(parse({ mode: 'fixed', value: 3900 })).toBe(true);
    expect(parse({ mode: 'fixed', value: -1 })).toBe(false);
    expect(parse({ mode: 'double', value: 2 })).toBe(false);
  });

  it('dedupes added and removed tags and lets a null brand clear it', () => {
    const parsed = bulkEditInputSchema.parse({
      productIds: ['1'],
      changes: { brandId: null, addTagIds: ['3', '3'], removeTagIds: ['4'] },
    });

    expect(parsed.changes).toEqual({ brandId: null, addTagIds: ['3'], removeTagIds: ['4'] });
  });
  it('reads an explicit null as absent everywhere but the brand, as the nullable GraphQL fields allow', () => {
    // Act
    const parsed = bulkEditInputSchema.parse({
      productIds: ['1'],
      changes: { status: null, addTagIds: null, removeTagIds: null, collectionIds: null, price: null, brandId: null },
      dryRun: null,
    });
    const onlyNulls = bulkEditInputSchema.safeParse({ productIds: ['1'], changes: { status: null, price: null } });

    // Assert
    expect(parsed.dryRun).toBe(false);
    expect(parsed.changes).toStrictEqual({
      status: undefined,
      addTagIds: undefined,
      removeTagIds: undefined,
      collectionIds: undefined,
      price: undefined,
      brandId: null,
    });
    expect(onlyNulls.success).toBe(false);
  });
});

describe('productBulkEditDiffSchema', () => {
  it('records the changed fields of one product', () => {
    expect(productBulkEditDiffSchema.safeParse({ changedFields: ['status', 'price'] }).success).toBe(true);
    expect(productBulkEditDiffSchema.safeParse({ changedFields: ['owner'] }).success).toBe(false);
    expect(productBulkEditDiffSchema.safeParse({ changedFields: [] }).success).toBe(false);
  });
});

describe('exportInputSchema (D2211)', () => {
  it('exports selected ids up to the sync cap', () => {
    expect(exportInputSchema.safeParse({ scope: 'selected', format: 'csv', productIds: idsOf(500) }).success).toBe(
      true,
    );
    expect(exportInputSchema.safeParse({ scope: 'selected', format: 'csv', productIds: idsOf(501) }).success).toBe(
      false,
    );
  });

  it('exports the filtered list query', () => {
    // Act
    const parsed = exportInputSchema.parse({ scope: 'filtered', format: 'xlsx', query: { tab: 'draft', q: 'robe' } });

    // Assert
    expect(parsed).toMatchObject({ scope: 'filtered', query: { tab: 'draft', q: 'robe' } });
  });

  it('orders the chosen columns as the export header and always keeps product_key, name and price', () => {
    // Act
    const parsed = exportInputSchema.parse({
      scope: 'selected',
      format: 'csv',
      productIds: ['1'],
      fields: ['description', 'variant_sku', 'name'],
    });

    // Assert
    expect(parsed.fields).toEqual(['product_key', 'name', 'description', 'price', 'variant_sku']);
  });

  it('exports every column when none is chosen', () => {
    expect(exportInputSchema.parse({ scope: 'selected', format: 'csv', productIds: ['1'] }).fields).toBeUndefined();
  });

  it('refuses an unknown format, scope or field', () => {
    expect(exportInputSchema.safeParse({ scope: 'selected', format: 'pdf', productIds: ['1'] }).success).toBe(false);
    expect(exportInputSchema.safeParse({ scope: 'all', format: 'csv' }).success).toBe(false);
    expect(
      exportInputSchema.safeParse({ scope: 'selected', format: 'csv', productIds: ['1'], fields: ['secret'] }).success,
    ).toBe(false);
  });
});

describe('uploadInputSchema (D2208)', () => {
  it('keeps the content type allow-list read-only', () => {
    expect(Object.isFrozen(IMPORT_CONTENT_TYPES)).toBe(true);
  });

  it('accepts an xlsx up to 10 MiB', () => {
    expect(
      uploadInputSchema.safeParse({ format: 'xlsx', size: IMPORT_MAX_BYTES, contentType: XLSX_TYPE }).success,
    ).toBe(true);
  });

  it('upload refuses size 0, size above 10 MiB and a content type outside the allow-list', () => {
    const upload = (size: number, contentType: string) =>
      uploadInputSchema.safeParse({ format: 'csv', size, contentType });

    expect(upload(0, 'text/csv').success).toBe(false);
    expect(upload(IMPORT_MAX_BYTES + 1, 'text/csv').success).toBe(false);
    expect(upload(100, 'text/html').success).toBe(false);
    expect(upload(100, 'text/csv').success).toBe(true);
  });

  it("refuses a content type that is not the format's", () => {
    expect(uploadInputSchema.safeParse({ format: 'csv', size: 100, contentType: XLSX_TYPE }).success).toBe(false);
  });
});

describe('import job inputs', () => {
  it('analyzes a job by id', () => {
    expect(analyzeInputSchema.safeParse({ importId: '7301' }).success).toBe(true);
    expect(analyzeInputSchema.safeParse({}).success).toBe(false);
  });

  it('maps each column once and each field once', () => {
    const mapping = (entries: unknown[]) => previewMappingSchema.safeParse({ mapping: entries }).success;

    expect(
      mapping([
        { column: 0, field: 'name' },
        { column: 1, field: null },
      ]),
    ).toBe(true);
    expect(
      mapping([
        { column: 0, field: 'name' },
        { column: 0, field: 'price' },
      ]),
    ).toBe(false);
    expect(
      mapping([
        { column: 0, field: 'name' },
        { column: 1, field: 'name' },
      ]),
    ).toBe(false);
    expect(mapping([{ column: IMPORT_MAX_COLUMNS, field: 'name' }])).toBe(false);
    expect(mapping([{ column: 0, field: 'unknown' }])).toBe(false);
  });

  it('pages the preview by at most 200 rows', () => {
    expect(importPreviewQuerySchema.parse({})).toEqual({ skip: 0, take: IMPORT_PREVIEW_PAGE_MAX });
    expect(importPreviewQuerySchema.safeParse({ take: IMPORT_PREVIEW_PAGE_MAX + 1 }).success).toBe(false);
  });

  it('takes an http or https link only', () => {
    expect(linkImportInputSchema.safeParse({ url: 'https://shop.example.test/p/1' }).success).toBe(true);
    expect(linkImportInputSchema.safeParse({ url: 'ftp://shop.example.test/p/1' }).success).toBe(false);
    expect(linkImportInputSchema.safeParse({ url: 'not a url' }).success).toBe(false);
    expect(linkImportInputSchema.safeParse({ url: `https://a.test/${'x'.repeat(2_048)}` }).success).toBe(false);
  });
});
