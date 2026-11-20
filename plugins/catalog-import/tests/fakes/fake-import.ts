import type { TenantScope } from '@cod/shared';
import type { ImportJobRecord } from '../../application/ports/import-job.port';
import type { ObjectHead, PresignGetRule } from '../../application/ports/object-storage.port';
import { asOperationContext, type OperationContext } from '../../application/ports/operation-context';
import type { JobRowRef } from '../../domain/job-kinds';
import type { ObjectKey } from '../../domain/object-keys';
import type { PlannedRow } from '../../domain/row-plan';
import { CsvSpreadsheetReader } from '../../infrastructure/csv-reader';

/** A `previewed` spreadsheet import as a unit test starts from. */
export function previewedJob(change: Partial<ImportJobRecord> = {}): ImportJobRecord {
  return {
    id: '900000000000101',
    status: 'previewed',
    format: 'csv',
    declaredSize: 120,
    declaredContentType: 'text/csv',
    etag: '"etag-1"',
    headerRow: 0,
    mapping: { assignments: [], warnings: [] },
    rowCount: 1,
    progress: 0,
    preview: { creates: 1, updates: 0, errors: 0, warnings: 0 },
    result: null,
    errorCode: null,
    actorAdministratorId: 5,
    ...change,
  };
}

/** A planned row of a unit test. */
export function plannedRow(change: Partial<PlannedRow> = {}): PlannedRow {
  return {
    rowNumber: 2,
    action: 'create',
    productKey: 'K',
    messages: [],
    values: { name: 'Shirt', price: 1500, options: [], imageUrls: [] },
    productId: null,
    variantId: null,
    ...change,
  };
}

/**
 * The ports a preview and a confirm run through, over maps: one import job table, its preview rows, the object
 * store's heads and the queue. Status moves are atomic as the database's conditional updates are; a unit of work
 * rolls the job table and the rows back when its work throws. `beforeMove` runs before every status move, so a test
 * can commit a concurrent change between a use case's reads and its move.
 */
export class FakeImportWorld {
  readonly jobs = new Map<string, ImportJobRecord>();
  readonly rows = new Map<string, PlannedRow[]>();
  readonly heads = new Map<string, ObjectHead>();
  readonly files = new Map<string, Uint8Array>();
  readonly enqueued: JobRowRef[] = [];
  readonly ctx: OperationContext = asOperationContext({});
  beforeMove: () => void = () => undefined;

  /** Moves the job `id` to `status` when it is in `from`; answers whether it moved. */
  private move(id: string, from: readonly string[], patch: Partial<ImportJobRecord>): boolean {
    this.beforeMove();
    const job = this.jobs.get(id);
    if (job === undefined || !from.includes(job.status)) return false;
    this.jobs.set(id, { ...job, ...patch });
    return true;
  }

  readonly jobStore = {
    byId: (_ctx: OperationContext, _scope: TenantScope, id: string): Promise<ImportJobRecord | undefined> =>
      Promise.resolve(this.jobs.get(id)),
    beginConfirm: (
      _ctx: OperationContext,
      _scope: TenantScope,
      id: string,
      by: { actorAdministratorId: number; at: Date },
    ): Promise<boolean> =>
      Promise.resolve(
        this.move(id, ['previewed'], { status: 'confirming', actorAdministratorId: by.actorAdministratorId }),
      ),
    markPreviewed: (
      _ctx: OperationContext,
      _scope: TenantScope,
      id: string,
      previewed: { mapping: ImportJobRecord['mapping']; preview: ImportJobRecord['preview'] },
    ): Promise<boolean> =>
      Promise.resolve(
        this.move(id, ['analyzed', 'previewed'], {
          status: 'previewed',
          mapping: previewed.mapping,
          preview: previewed.preview,
        }),
      ),
  };

  readonly rowStore = {
    hasUpdates: (_ctx: OperationContext, _scope: TenantScope, jobId: string): Promise<boolean> =>
      Promise.resolve((this.rows.get(jobId) ?? []).some((row) => row.action === 'update')),
    replace: (
      _ctx: OperationContext,
      _scope: TenantScope,
      jobId: string,
      rows: readonly PlannedRow[],
    ): Promise<void> => {
      this.rows.set(jobId, [...rows]);
      return Promise.resolve();
    },
    page: (_ctx: OperationContext, _scope: TenantScope, jobId: string) => {
      const rows = this.rows.get(jobId) ?? [];
      return Promise.resolve({ rows: rows.map((row) => ({ ...row, applied: false })), total: rows.length });
    },
  };

  readonly catalog = {
    findBySkus: () => Promise.resolve(new Map()),
    product: () => Promise.resolve(undefined),
    taxonomyIndex: () => Promise.resolve({ brands: [], tags: [] }),
  };

  readonly storage = {
    read: (key: ObjectKey): Promise<Uint8Array> => {
      const file = this.files.get(key);
      return file === undefined ? Promise.reject(new Error('no such object')) : Promise.resolve(file);
    },
    head: (key: ObjectKey): Promise<ObjectHead | null> => Promise.resolve(this.heads.get(key) ?? null),
    presignGet: (key: ObjectKey, rule: PresignGetRule): Promise<string> =>
      Promise.resolve(`fake://${key}?name=${rule.downloadName}`),
  };

  readonly formats = {
    get: () => ({
      contentType: 'text/csv',
      extension: 'csv',
      writer: { write: () => Promise.resolve(new Uint8Array()) },
      reader: new CsvSpreadsheetReader(),
    }),
  };

  readonly units = {
    run: async <T>(
      ctx: OperationContext,
      _scope: TenantScope,
      work: (tx: OperationContext) => Promise<T>,
    ): Promise<T> => {
      const jobs = new Map(this.jobs);
      const rows = new Map(this.rows);
      try {
        return await work(ctx);
      } catch (error: unknown) {
        this.restore(jobs, rows);
        throw error;
      }
    },
  };

  private restore(jobs: ReadonlyMap<string, ImportJobRecord>, rows: ReadonlyMap<string, PlannedRow[]>): void {
    this.jobs.clear();
    for (const [id, job] of jobs) this.jobs.set(id, job);
    this.rows.clear();
    for (const [id, planned] of rows) this.rows.set(id, planned);
  }

  readonly queue = {
    enqueue: (row: JobRowRef): Promise<void> => {
      this.enqueued.push(row);
      return Promise.resolve();
    },
  };
}
