import { DOWNLOAD_URL_TTL_SECONDS, type ExportJobStatus } from '@cod/shared';
import { EXPORT_DOWNLOAD_BASE } from '../domain/constants';
import { exportFileKey } from '../domain/object-keys';
import type { StoreScope } from '../domain/store-scope';
import type { ExportJobRecord } from './ports/export-job.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { SpreadsheetFormatAdapter } from './ports/spreadsheet-format.port';
import type { SpreadsheetFormatRegistry } from './spreadsheet-format.registry';

/** An export as both API surfaces answer it; `downloadUrl` is a fresh presigned GET once the file is written. */
export interface ExportView {
  readonly exportId: string;
  readonly status: ExportJobStatus;
  /** Percentage of the products read so far. */
  readonly progress: number;
  readonly rowCount: number;
  readonly skippedPacks: number;
  readonly errorCode: string | null;
  readonly downloadUrl: string | null;
}

/** What {@link exportViewOf} signs links through. */
export interface ExportViewDeps {
  readonly storage: Pick<ObjectStorage, 'presignGet'>;
  readonly formats: Pick<SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>, 'get'>;
}

/**
 * The answer about an export row of the scope's store (D2208): a done export gets a presigned GET of its file under
 * `exports/`, valid 5 minutes, as an attachment named `products-<exportId>.<extension>` (no store or product text).
 * Call it only after the row was read in the caller's own scope.
 */
export async function exportViewOf(deps: ExportViewDeps, scope: StoreScope, job: ExportJobRecord): Promise<ExportView> {
  const adapter = deps.formats.get(job.format);
  const downloadUrl =
    job.status === 'done'
      ? await deps.storage.presignGet(exportFileKey(scope, job.id), {
          ttlSeconds: DOWNLOAD_URL_TTL_SECONDS,
          downloadName: `${EXPORT_DOWNLOAD_BASE}-${job.id}.${adapter.extension}`,
          contentType: adapter.contentType,
        })
      : null;
  return {
    exportId: job.id,
    status: job.status,
    progress: job.progress,
    rowCount: job.rowCount,
    skippedPacks: job.skippedPacks,
    errorCode: job.errorCode,
    downloadUrl,
  };
}
