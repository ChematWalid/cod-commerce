import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { ImportJobKind, ImportJobStatus } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type {
  AnalyzedImport,
  ConfirmingActor,
  ImportJobRecord,
  ImportJobStore,
  ImportResult,
  NewImportJob,
  PreviewedImport,
} from '../application/ports/import-job.port';
import type { OperationContext } from '../application/ports/operation-context';
import type { ColumnMap } from '../domain/column-mapper';
import { PROGRESS_DONE } from '../domain/constants';
import { RUNNING_JOB_STATUS } from '../domain/job-kinds';
import type { StoreScope } from '../domain/store-scope';
import { importJobRecordOf, type StoredImportSummary } from './import-job-rows';
import { ImportJobEntity } from './import-job.entity';
import { requestScope } from './request-context';

/** The kind of every row this store reads and writes; link imports are another use case's (D2214). */
const SPREADSHEET: ImportJobKind = 'spreadsheet';

/** What a status move may write; the JSON columns take the store's own shapes. */
type ImportPatch = Partial<
  Pick<
    ImportJobEntity,
    | 'status'
    | 'etag'
    | 'headerRow'
    | 'mappingHash'
    | 'rowCount'
    | 'progress'
    | 'actorAdministratorId'
    | 'updatedAt'
    | 'finishedAt'
  > & { mapping: ColumnMap; summary: StoredImportSummary }
>;

/**
 * {@link ImportJobStore} on `catalog_import_job` through `TenantRepository` (ADR 0002): every call matches the scope's
 * business and store and the spreadsheet kind only, joins the transaction `ctx` carries, and never changes a `done` or
 * `failed` row. Status moves are conditional updates, so two concurrent confirms move the row once (Review Focus 4).
 */
@Injectable()
export class TypeOrmImportJobStore implements ImportJobStore {
  private readonly rows: TenantRepository<ImportJobEntity>;

  constructor(factory: TenantRepositoryFactory) {
    this.rows = factory.for(ImportJobEntity);
  }

  async create(ctx: OperationContext, scope: StoreScope, job: NewImportJob): Promise<void> {
    await this.rows.insert(requestScope(ctx, scope), {
      id: job.id,
      storeId: scope.storeId,
      kind: SPREADSHEET,
      status: 'awaiting_upload',
      format: job.format,
      declaredSize: job.declaredSize,
      declaredContentType: job.declaredContentType,
      rowCount: 0,
      progress: 0,
      actorAdministratorId: job.actorAdministratorId,
      createdAt: job.at,
      updatedAt: job.at,
    });
  }

  async byId(ctx: OperationContext, scope: StoreScope, id: string): Promise<ImportJobRecord | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { id, storeId: scope.storeId, kind: SPREADSHEET });
    return row === null ? undefined : importJobRecordOf(row);
  }

  async markAnalyzed(ctx: OperationContext, scope: StoreScope, id: string, analyzed: AnalyzedImport): Promise<void> {
    await this.move(ctx, scope, {
      id,
      from: ['awaiting_upload', 'analyzed'],
      patch: {
        status: 'analyzed',
        etag: analyzed.etag,
        headerRow: analyzed.headerRow,
        mapping: analyzed.mapping,
        mappingHash: analyzed.mappingHash,
        rowCount: analyzed.rowCount,
        updatedAt: analyzed.at,
      },
    });
  }

  async markPreviewed(ctx: OperationContext, scope: StoreScope, id: string, previewed: PreviewedImport): Promise<void> {
    const summary: StoredImportSummary = { preview: previewed.preview };
    await this.move(ctx, scope, {
      id,
      from: ['analyzed', 'previewed'],
      patch: {
        status: 'previewed',
        mapping: previewed.mapping,
        mappingHash: previewed.mappingHash,
        summary,
        updatedAt: previewed.at,
      },
    });
  }

  async beginConfirm(ctx: OperationContext, scope: StoreScope, id: string, by: ConfirmingActor): Promise<boolean> {
    const moved = await this.move(ctx, scope, {
      id,
      from: ['previewed'],
      patch: { status: 'confirming', actorAdministratorId: by.actorAdministratorId, updatedAt: by.at },
    });
    return moved === 1;
  }

  async markRunning(ctx: OperationContext, scope: StoreScope, id: string, at: Date): Promise<void> {
    await this.move(ctx, scope, {
      id,
      from: ['confirming', RUNNING_JOB_STATUS],
      patch: { status: RUNNING_JOB_STATUS, updatedAt: at },
    });
  }

  async setProgress(ctx: OperationContext, scope: StoreScope, id: string, progress: number): Promise<void> {
    await this.move(ctx, scope, { id, from: [RUNNING_JOB_STATUS], patch: { progress, updatedAt: new Date() } });
  }

  async finish(
    ctx: OperationContext,
    scope: StoreScope,
    id: string,
    done: { result: ImportResult; at: Date },
  ): Promise<void> {
    const current = await this.byId(ctx, scope, id);
    const summary: StoredImportSummary = {
      ...(current?.preview ? { preview: current.preview } : {}),
      result: done.result,
    };
    await this.move(ctx, scope, {
      id,
      from: ['confirming', RUNNING_JOB_STATUS],
      patch: { status: 'done', progress: PROGRESS_DONE, summary, updatedAt: done.at, finishedAt: done.at },
    });
  }

  /** Patches the scope's spreadsheet row when its status is one of `from`; answers how many rows moved (0 or 1). */
  private move(
    ctx: OperationContext,
    scope: StoreScope,
    change: { readonly id: string; readonly from: readonly ImportJobStatus[]; readonly patch: ImportPatch },
  ): Promise<number> {
    // `from` never names done or failed: an ended row is never changed again.
    const where = { id: change.id, storeId: scope.storeId, kind: SPREADSHEET, status: In([...change.from]) };
    return this.rows.update(requestScope(ctx, scope), where, change.patch);
  }
}
