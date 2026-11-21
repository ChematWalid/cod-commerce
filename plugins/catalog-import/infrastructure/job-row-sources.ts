import type { JobRepositoryPort, JobRowSource, JobScanPort } from '../application/ports/job-repository.port';
import { type JobTable, tableOfKind } from '../domain/job-kinds';

/** What catalog-import's own row sources read and write through. */
export interface OwnJobRowsDeps {
  readonly scan: Pick<JobScanPort, 'rowScopeOf'>;
  readonly jobs: Pick<JobRepositoryPort, 'markFailed'>;
}

/** The {@link JobRowSource} of one of catalog-import's job tables (D2252). */
export function tableRowSource(table: JobTable, deps: OwnJobRowsDeps): JobRowSource {
  return {
    rowScopeOf: (recordId) => deps.scan.rowScopeOf({ table, id: recordId }),
    markFailed: (scope, recordId, failure) => deps.jobs.markFailed(scope, { table, id: recordId }, failure),
  };
}

/** The row source of a kind catalog-import stores, or undefined for a kind another plugin stores (D2252). */
export function ownRowSourceOf(kind: string, deps: OwnJobRowsDeps): JobRowSource | undefined {
  const table = tableOfKind(kind);
  return table === undefined ? undefined : tableRowSource(table, deps);
}
