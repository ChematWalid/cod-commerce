import {
  DURABLE_JOB_KINDS,
  durableJobId,
  type ExportJobStatus,
  type ImportJobStatus,
  IMPORTS_EXPORTS_JOB_KINDS,
} from '@cod/shared';
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

/** The table whose rows a queue kind runs, or undefined for a kind another plugin stores with its own rows (D2252). */
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

/** A status of an import or export row; a kind another plugin stores reports its rows in these words (D2252). */
export type JobStatus = ImportJobStatus | ExportJobStatus;

/** A row a worker has picked up. */
export const RUNNING_JOB_STATUS = 'running' satisfies JobStatus;
/** A row that ended badly. */
export const FAILED_JOB_STATUS = 'failed' satisfies JobStatus;

/** Rows a worker may still run: confirmed imports, queued exports, and a run that a retry picks up again. */
export const RUNNABLE_JOB_STATUSES: readonly JobStatus[] = ['confirming', 'queued', RUNNING_JOB_STATUS];
/** Rows the reconciler re-enqueues when their BullMQ job is lost (D2212). */
export const REQUEUE_JOB_STATUSES: readonly JobStatus[] = ['confirming', 'queued'];
/** Rows that are over: nothing changes them again. */
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ['done', FAILED_JOB_STATUS];
