import type { TenantScope } from '@cod/shared';
import type { ExportFile, ExportFileRequest } from '../../application/export-file.builder';
import type { ExportIdsPage, ExportIdsPageRequest } from '../../application/ports/catalog-export-reads.port';
import type { ExportActivity } from '../../application/ports/export-activity.port';
import type {
  ExportJobRecord,
  ExportJobStore,
  ExportResult,
  NewExportJob,
} from '../../application/ports/export-job.port';
import type { JobRowRef } from '../../domain/job-kinds';
import type { ObjectKey } from '../../domain/object-keys';
import type { PresignGetRule } from '../../application/ports/object-storage.port';
import { asOperationContext, type OperationContext } from '../../application/ports/operation-context';

/**
 * Every port an export runs through, over arrays: a store holding `productCount` products (ids 1..n), an export job
 * table, the object store, the queue and the activity log. A unit of work commits its writes at once.
 */
export class FakeExportWorld {
  readonly rows = new Map<string, ExportJobRecord>();
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  readonly enqueued: JobRowRef[] = [];
  readonly activities: ExportActivity[] = [];
  readonly progress: number[] = [];
  readonly builds: ExportFileRequest[] = [];
  readonly pageReads: ExportIdsPageRequest[] = [];
  private nextId = 900_000_000_001n;

  /** Rows each product writes: one per variant. */
  variantsPerProduct = 1;

  constructor(public productCount: number) {}

  readonly ids = { next: (): string => String(this.nextId++) };

  readonly reads = {
    idsPage: (_ctx: OperationContext, _scope: TenantScope, page: ExportIdsPageRequest): Promise<ExportIdsPage> => {
      this.pageReads.push(page);
      const end = Math.min(page.skip + page.take, this.productCount);
      const ids = Array.from({ length: Math.max(0, end - page.skip) }, (_, index) => String(page.skip + index + 1));
      return Promise.resolve({ ids, nextSkip: end < this.productCount ? end : null, total: this.productCount });
    },
  };

  readonly files = {
    build: async (
      _ctx: OperationContext,
      _scope: TenantScope,
      request: ExportFileRequest,
    ): Promise<ExportFile | undefined> => {
      this.builds.push(request);
      const rowCount = request.productIds.length * this.variantsPerProduct;
      if (rowCount > request.maxRows) return undefined;
      await request.onProgress?.(request.productIds.length);
      return {
        bytes: new TextEncoder().encode(request.productIds.join(',')),
        contentType: 'text/csv',
        rowCount,
        skippedPacks: 0,
      };
    },
  };

  readonly storage = {
    write: (key: ObjectKey, body: Uint8Array | AsyncIterable<Uint8Array>, contentType: string): Promise<void> => {
      if (!(body instanceof Uint8Array)) throw new Error('the fake stores bytes only');
      this.objects.set(key, { bytes: body, contentType });
      return Promise.resolve();
    },
    presignGet: (key: ObjectKey, rule: PresignGetRule): Promise<string> =>
      Promise.resolve(`fake://${key}?name=${rule.downloadName}`),
  };

  readonly formats = {
    get: () => ({
      contentType: 'text/csv',
      extension: 'csv',
      writer: { write: () => Promise.resolve(new Uint8Array()) },
    }),
  };

  readonly units = {
    run: <T>(ctx: OperationContext, _scope: TenantScope, work: (tx: OperationContext) => Promise<T>): Promise<T> =>
      work(ctx),
  };

  readonly activity = {
    recordExport: (_ctx: OperationContext, activity: ExportActivity): Promise<void> => {
      this.activities.push(activity);
      return Promise.resolve();
    },
  };

  readonly queue = {
    enqueue: (row: JobRowRef): Promise<void> => {
      this.enqueued.push(row);
      return Promise.resolve();
    },
  };

  readonly jobs: ExportJobStore = {
    create: (_ctx, _scope, job: NewExportJob) => {
      const done = job.status === 'done';
      this.rows.set(job.id, {
        ...job,
        progress: done ? 100 : 0,
        errorCode: null,
        actorAdministratorId: job.actorAdministratorId,
      });
      return Promise.resolve();
    },
    byId: (_ctx, _scope, id) => Promise.resolve(this.rows.get(id)),
    markRunning: (_ctx, _scope, id) => this.patch(id, { status: 'running' }),
    setProgress: (_ctx, _scope, id, progress) => {
      this.progress.push(progress);
      return this.patch(id, { progress });
    },
    finish: (_ctx, _scope, id, result: ExportResult) =>
      this.patch(id, { status: 'done', progress: 100, rowCount: result.rowCount, skippedPacks: result.skippedPacks }),
    fail: (_ctx, _scope, id, failure) => this.patch(id, { status: 'failed', errorCode: failure.errorCode }),
  };

  readonly ctx = asOperationContext({});

  private patch(id: string, change: Partial<ExportJobRecord>): Promise<void> {
    const row = this.rows.get(id);
    if (row !== undefined) this.rows.set(id, { ...row, ...change });
    return Promise.resolve();
  }
}
