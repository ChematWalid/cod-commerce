import { DomainError, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '@cod/shared';
import { mapColumns } from '../domain/column-mapper';
import { FileTooLargeError, FileTypeError, JobStateError, NoHeaderError, TooManyRowsError } from '../domain/errors';
import { detectHeader } from '../domain/header-detect';
import { importSourceKey } from '../domain/object-keys';
import type { StoreScope } from '../domain/store-scope';
import { dataRowsOf, importOf, type ImportSourceDeps, mappingHashOf, readSource } from './import-source';
import { type ImportView, importViewOf, type ImportViewDeps } from './import-view';
import type { ImportJobRecord, ImportJobStore } from './ports/import-job.port';
import type { ObjectHead, ObjectStorage } from './ports/object-storage.port';
import type { OperationContext } from './ports/operation-context';
import type { SheetRows } from './ports/spreadsheet-format.port';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** What {@link AnalyzeImportService} runs through. */
export interface AnalyzeImportDeps extends ImportSourceDeps, ImportViewDeps {
  readonly jobs: Pick<ImportJobStore, 'byId' | 'markAnalyzed'>;
  readonly storage: Pick<ObjectStorage, 'head' | 'read' | 'delete' | 'presignGet'>;
  readonly units: UnitOfWorkPort;
  readonly now?: () => Date;
}

/** The statuses analyze runs from: a fresh upload, or a file analyzed again before its preview. */
const ANALYZABLE = new Set(['awaiting_upload', 'analyzed']);

/**
 * "Analyze the uploaded file" (D2208, D2210, D2222): HEAD is the real gate (no object: `job-state`; larger than the
 * cap or than declared: `file-too-large`; another content type than declared: `file-type`; the object is deleted),
 * then the bytes, read pinned to the HEAD's ETag, must sniff as the declared format and pass the reader's limits
 * (else `file-type`, object deleted); the header row is looked for in the first 10 rows (`no-header`), at most
 * 5 000 data rows (`too-many-rows`). Stores the ETag, the header row, the detected mapping and the row count.
 */
export class AnalyzeImportService {
  private readonly now: () => Date;

  constructor(private readonly deps: AnalyzeImportDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async analyze(ctx: OperationContext, scope: StoreScope, importId: string): Promise<ImportView> {
    const job = await importOf(this.deps.jobs, ctx, scope, importId);
    if (!ANALYZABLE.has(job.status)) throw new JobStateError();
    const head = await this.gate(scope, job);
    const sheet = await this.sheetOf(scope, job, head.etag);
    const found = detectHeader(sheet.rows.map((row) => row.cells));
    if (found.kind === 'no-header') throw new NoHeaderError();
    const header = sheet.rows[found.rowIndex];
    if (header === undefined) throw new NoHeaderError();
    const headerRow = header.number - 1;
    const rowCount = dataRowsOf(sheet.rows, headerRow).length;
    if (sheet.truncated || rowCount > IMPORT_MAX_ROWS) throw new TooManyRowsError();
    const mapping = mapColumns(header.cells);
    const analyzed = {
      etag: head.etag,
      headerRow,
      mapping,
      mappingHash: mappingHashOf(mapping),
      rowCount,
      at: this.now(),
    };
    await this.deps.units.run(ctx, scope, (tx) => this.deps.jobs.markAnalyzed(tx, scope, job.id, analyzed));
    return importViewOf(this.deps, scope, { ...job, status: 'analyzed', ...analyzed });
  }

  /** The object's HEAD, if it is what the upload declared; otherwise the object is deleted and the refusal thrown. */
  private async gate(scope: StoreScope, job: ImportJobRecord): Promise<ObjectHead> {
    const key = importSourceKey(scope, job.id);
    const head = await this.deps.storage.head(key);
    if (head === null) throw new JobStateError();
    const refusal = refusalOf(head, job);
    if (refusal !== undefined) {
      await this.deps.storage.delete(key);
      throw refusal;
    }
    return head;
  }

  /** The file's rows; a file that is not of its format, or that a reader refuses, is deleted. */
  private async sheetOf(scope: StoreScope, job: ImportJobRecord, etag: string): Promise<SheetRows> {
    try {
      return await readSource(this.deps, scope, { job, etag });
    } catch (error: unknown) {
      if (error instanceof FileTypeError || error instanceof FileTooLargeError) {
        await this.deps.storage.delete(importSourceKey(scope, job.id));
      }
      throw error;
    }
  }
}

/** Why a HEAD does not match the upload (D2208), or undefined when it does. */
function refusalOf(head: ObjectHead, job: ImportJobRecord): DomainError | undefined {
  if (head.size > IMPORT_MAX_BYTES || head.size !== job.declaredSize) return new FileTooLargeError();
  if (head.contentType !== job.declaredContentType) return new FileTypeError();
  return undefined;
}
