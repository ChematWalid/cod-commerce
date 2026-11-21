import { IMPORT_FORMATS, type ImportFormat } from '@cod/shared';
import type { ImportJobRecord, ImportPreviewSummary, ImportResult } from '../application/ports/import-job.port';
import type { StoredImportRow } from '../application/ports/import-row.port';
import type { ColumnMap } from '../domain/column-mapper';
import type { ImportRowValues } from '../domain/import-row';
import type { PlannedRow } from '../domain/row-plan';
import type { ImportJobEntity } from './import-job.entity';
import type { ImportRowEntity } from './import-row.entity';

/** What the job's `summary` column holds: the preview's counts, then what confirm did. */
export interface StoredImportSummary {
  readonly preview?: ImportPreviewSummary;
  readonly result?: ImportResult;
}

/** What a row's `data` column holds beside its action, reasons and product id. */
interface StoredRowData {
  readonly productKey: string | null;
  readonly values: ImportRowValues;
  readonly variantId: string | null;
  readonly brandId?: string;
  readonly tagIds?: readonly string[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The format of a row; the column only ever holds a registered one, anything else reads as CSV. */
const formatOf = (stored: string | null): ImportFormat =>
  IMPORT_FORMATS.find((format) => format === stored) ?? IMPORT_FORMATS[1];

/** The summary column as written by the store; a missing part is null. */
function summaryOf(stored: unknown): StoredImportSummary {
  return isObject(stored) ? stored : {};
}

/** The mapping column as written by analyze or preview, or null before analyze. */
const mappingOf = (stored: unknown): ColumnMap | null =>
  isObject(stored) && Array.isArray(stored['assignments']) ? (stored as unknown as ColumnMap) : null;

/** A job row as the import use cases read it. */
export function importJobRecordOf(row: ImportJobEntity): ImportJobRecord {
  const summary = summaryOf(row.summary);
  return {
    id: row.id,
    status: row.status,
    format: formatOf(row.format),
    declaredSize: row.declaredSize ?? 0,
    declaredContentType: row.declaredContentType ?? '',
    etag: row.etag,
    headerRow: row.headerRow,
    mapping: mappingOf(row.mapping),
    rowCount: row.rowCount,
    progress: row.progress,
    preview: summary.preview ?? null,
    result: summary.result ?? null,
    errorCode: row.errorCode,
    actorAdministratorId: row.actorAdministratorId,
  };
}

/** The `data` column of a planned row. */
export function rowDataOf(row: PlannedRow): StoredRowData {
  return {
    productKey: row.productKey,
    values: row.values,
    variantId: row.variantId,
    ...(row.brandId === undefined ? {} : { brandId: row.brandId }),
    ...(row.tagIds === undefined ? {} : { tagIds: row.tagIds }),
  };
}

const EMPTY_VALUES: ImportRowValues = { options: [], imageUrls: [] };

/** A stored row as the use cases read it. */
export function storedRowOf(row: ImportRowEntity): StoredImportRow {
  const data = (isObject(row.data) ? row.data : {}) as Partial<StoredRowData>;
  return {
    rowNumber: row.rowNumber,
    action: row.action as StoredImportRow['action'],
    productKey: data.productKey ?? null,
    messages: (Array.isArray(row.reasons) ? row.reasons : []) as StoredImportRow['messages'],
    values: data.values ?? EMPTY_VALUES,
    productId: row.productId === null ? null : String(row.productId),
    variantId: data.variantId ?? null,
    ...(data.brandId === undefined ? {} : { brandId: data.brandId }),
    ...(data.tagIds === undefined ? {} : { tagIds: data.tagIds }),
    applied: row.applied,
  };
}
