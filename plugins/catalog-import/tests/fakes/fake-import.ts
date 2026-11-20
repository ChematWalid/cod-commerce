import type { TenantScope } from '@cod/shared';
import type { ImportJobRecord } from '../../application/ports/import-job.port';
import type { ObjectHead, PresignGetRule } from '../../application/ports/object-storage.port';
import { asOperationContext, type OperationContext } from '../../application/ports/operation-context';
import type { JobRowRef } from '../../domain/job-kinds';
import type { ObjectKey } from '../../domain/object-keys';
import type { PlannedRow } from '../../domain/row-plan';

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
 * The ports a confirm runs through, over maps: one import job table, its preview rows, the object store's heads and
 * the queue. `beginConfirm` is atomic as the database's conditional update is.
 */
export class FakeImportWorld {
  readonly jobs = new Map<string, ImportJobRecord>();
  readonly rows = new Map<string, PlannedRow[]>();
  readonly heads = new Map<string, ObjectHead>();
  readonly enqueued: JobRowRef[] = [];
  readonly ctx: OperationContext = asOperationContext({});

  readonly jobStore = {
    byId: (_ctx: OperationContext, _scope: TenantScope, id: string): Promise<ImportJobRecord | undefined> =>
      Promise.resolve(this.jobs.get(id)),
    beginConfirm: (
      _ctx: OperationContext,
      _scope: TenantScope,
      id: string,
      by: { actorAdministratorId: number; at: Date },
    ): Promise<boolean> => {
      const job = this.jobs.get(id);
      if (job?.status !== 'previewed') return Promise.resolve(false);
      this.jobs.set(id, { ...job, status: 'confirming', actorAdministratorId: by.actorAdministratorId });
      return Promise.resolve(true);
    },
  };

  readonly rowStore = {
    hasUpdates: (_ctx: OperationContext, _scope: TenantScope, jobId: string): Promise<boolean> =>
      Promise.resolve((this.rows.get(jobId) ?? []).some((row) => row.action === 'update')),
  };

  readonly storage = {
    head: (key: ObjectKey): Promise<ObjectHead | null> => Promise.resolve(this.heads.get(key) ?? null),
    presignGet: (key: ObjectKey, rule: PresignGetRule): Promise<string> =>
      Promise.resolve(`fake://${key}?name=${rule.downloadName}`),
  };

  readonly formats = {
    get: () => ({
      contentType: 'text/csv',
      extension: 'csv',
      writer: { write: () => Promise.resolve(new Uint8Array()) },
      reader: { read: () => Promise.reject(new Error('the fake reads no file')) },
    }),
  };

  readonly units = {
    run: <T>(ctx: OperationContext, _scope: TenantScope, work: (tx: OperationContext) => Promise<T>): Promise<T> =>
      work(ctx),
  };

  readonly queue = {
    enqueue: (row: JobRowRef): Promise<void> => {
      this.enqueued.push(row);
      return Promise.resolve();
    },
  };
}
