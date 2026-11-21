import { IMPORT_FIELD_KEYS, type ImportFieldKey, type ImportFormat, IMPORT_FORMATS } from '@cod/shared';
import type { ExportJobRecord } from '../application/ports/export-job.port';
import type { ExportFilter, ExportTarget } from '../domain/export-target';
import type { ExportJobEntity } from './export-job.entity';

/** What the `query` column holds: the selected ids, or the filter of a filtered export. */
type StoredQuery = { readonly productIds: readonly string[] } | { readonly filter: ExportFilter };

const FIELD_KEYS: ReadonlySet<string> = new Set(IMPORT_FIELD_KEYS);
const FORMATS: ReadonlySet<string> = new Set(IMPORT_FORMATS);

const isFieldKey = (value: unknown): value is ImportFieldKey => typeof value === 'string' && FIELD_KEYS.has(value);

/** The `query` column of a target. */
export function storedQueryOf(target: ExportTarget): StoredQuery {
  return target.kind === 'selected' ? { productIds: [...target.productIds] } : { filter: target.filter };
}

/**
 * The target a row stored. The columns are written only by {@link storedQueryOf}; a row that does not read back is a
 * fault of the server, never a guess.
 * @throws Error for a row whose `scope` and `query` do not match
 */
function targetOf(row: ExportJobEntity): ExportTarget {
  const query = row.query as Partial<Record<'productIds' | 'filter', unknown>> | null;
  if (row.scope === 'selected' && Array.isArray(query?.productIds)) {
    return { kind: 'selected', productIds: query.productIds.map(String) };
  }
  if (row.scope === 'filtered' && typeof query?.filter === 'object' && query.filter !== null) {
    return { kind: 'filtered', filter: query.filter as ExportFilter };
  }
  throw new Error(`Export job ${row.id} holds an unreadable target`);
}

/**
 * The stored format of a row.
 * @throws Error for a format no adapter writes
 */
function formatOf(row: ExportJobEntity): ImportFormat {
  if (!FORMATS.has(row.format)) throw new Error(`Export job ${row.id} holds an unknown format`);
  return row.format as ImportFormat;
}

/** A row as the export use cases read it. */
export function exportJobRecordOf(row: ExportJobEntity): ExportJobRecord {
  return {
    id: row.id,
    status: row.status,
    format: formatOf(row),
    target: targetOf(row),
    fields: Array.isArray(row.fields) ? row.fields.filter(isFieldKey) : [],
    rowCount: row.rowCount,
    progress: row.progress,
    skippedPacks: row.skippedPacks,
    errorCode: row.errorCode,
    actorAdministratorId: row.actorAdministratorId,
  };
}
