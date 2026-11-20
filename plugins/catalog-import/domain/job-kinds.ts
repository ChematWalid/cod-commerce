import { DURABLE_JOB_KINDS, durableJobId, IMPORTS_EXPORTS_JOB_KINDS } from '@cod/shared';
import type { ImportsExportsJobData } from './imports-exports-job';

/** Which job table a row lives in: `catalog_import_job` or `catalog_export_job`. */
export type JobTable = 'import' | 'export';

/** A job row and the scope it holds: what a queue payload is built from (D2212). */
export interface JobRowRef {
  readonly table: JobTable;
  readonly id: string;
  readonly businessId: string;
  readonly storeId: string;
}

const KIND_OF_TABLE = {
  import: IMPORTS_EXPORTS_JOB_KINDS.productImport,
  export: IMPORTS_EXPORTS_JOB_KINDS.productExport,
} as const satisfies Record<JobTable, string>;

const DURABLE_PREFIX_OF_TABLE = {
  import: DURABLE_JOB_KINDS.catalogImport,
  export: DURABLE_JOB_KINDS.catalogExport,
} as const satisfies Record<JobTable, string>;

const TABLES: readonly JobTable[] = ['import', 'export'];

/** The table whose rows a queue kind runs, or undefined for a kind catalog-import does not store (P4.S2's). */
export function tableOfKind(kind: string): JobTable | undefined {
  return TABLES.find((table) => KIND_OF_TABLE[table] === kind);
}

/** The queue payload of a job row: a durable id per row (`cim-<id>`, `cex-<id>`), so a re-add is deduplicated. */
export function jobDataOf(row: JobRowRef): ImportsExportsJobData {
  return {
    jobId: durableJobId(DURABLE_PREFIX_OF_TABLE[row.table], row.id),
    kind: KIND_OF_TABLE[row.table],
    recordId: row.id,
    businessId: row.businessId,
    storeId: row.storeId,
  };
}

/** Rows a worker may still run: confirmed imports, queued exports, and a run that a retry picks up again. */
export const RUNNABLE_JOB_STATUSES: readonly string[] = ['confirming', 'queued', 'running'];
/** Rows the reconciler re-enqueues when their BullMQ job is lost (D2212). */
export const REQUEUE_JOB_STATUSES: readonly string[] = ['confirming', 'queued'];
/** Rows that are over: nothing changes them again. */
export const TERMINAL_JOB_STATUSES: readonly string[] = ['done', 'failed'];
