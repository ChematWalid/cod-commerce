import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { In, Not } from 'typeorm';
import type { ExportJobRecord, ExportJobStore, ExportResult, NewExportJob } from '../application/ports/export-job.port';
import type { OperationContext } from '../application/ports/operation-context';
import { PROGRESS_DONE } from '../domain/constants';
import { FAILED_JOB_STATUS, RUNNING_JOB_STATUS, TERMINAL_JOB_STATUSES } from '../domain/job-kinds';
import type { StoreScope } from '../domain/store-scope';
import { ExportJobEntity } from './export-job.entity';
import { exportJobRecordOf, storedQueryOf } from './export-job-rows';
import { requestScope } from './request-context';

type ExportPatch = Partial<
  Pick<ExportJobEntity, 'status' | 'progress' | 'rowCount' | 'skippedPacks' | 'errorCode' | 'updatedAt' | 'finishedAt'>
>;

/**
 * {@link ExportJobStore} on `catalog_export_job` through `TenantRepository` (ADR 0002): every call matches the scope's
 * business and store only, joins the transaction `ctx` carries, and never changes a `done` or `failed` row.
 */
@Injectable()
export class TypeOrmExportJobStore implements ExportJobStore {
  private readonly rows: TenantRepository<ExportJobEntity>;

  constructor(factory: TenantRepositoryFactory) {
    this.rows = factory.for(ExportJobEntity);
  }

  async create(ctx: OperationContext, scope: StoreScope, job: NewExportJob): Promise<void> {
    const done = job.status === 'done';
    await this.rows.insert(requestScope(ctx, scope), {
      id: job.id,
      storeId: scope.storeId,
      status: job.status,
      format: job.format,
      scope: job.target.kind,
      query: storedQueryOf(job.target),
      fields: [...job.fields],
      rowCount: job.rowCount,
      progress: done ? PROGRESS_DONE : 0,
      skippedPacks: job.skippedPacks,
      actorAdministratorId: job.actorAdministratorId,
      errorCode: null,
      createdAt: job.at,
      updatedAt: job.at,
      finishedAt: done ? job.at : null,
    });
  }

  async byId(ctx: OperationContext, scope: StoreScope, id: string): Promise<ExportJobRecord | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { id, storeId: scope.storeId });
    return row === null ? undefined : exportJobRecordOf(row);
  }

  async markRunning(ctx: OperationContext, scope: StoreScope, id: string, at: Date): Promise<void> {
    await this.patchOpen(ctx, scope, { id, patch: { status: RUNNING_JOB_STATUS, updatedAt: at } });
  }

  async setProgress(ctx: OperationContext, scope: StoreScope, id: string, progress: number): Promise<void> {
    await this.patchOpen(ctx, scope, { id, patch: { progress, updatedAt: new Date() } });
  }

  async finish(ctx: OperationContext, scope: StoreScope, id: string, result: ExportResult): Promise<void> {
    await this.patchOpen(ctx, scope, {
      id,
      patch: {
        status: 'done',
        progress: PROGRESS_DONE,
        rowCount: result.rowCount,
        skippedPacks: result.skippedPacks,
        updatedAt: result.at,
        finishedAt: result.at,
      },
    });
  }

  async fail(
    ctx: OperationContext,
    scope: StoreScope,
    id: string,
    failure: { errorCode: string; at: Date },
  ): Promise<void> {
    await this.patchOpen(ctx, scope, {
      id,
      patch: { status: FAILED_JOB_STATUS, errorCode: failure.errorCode, updatedAt: failure.at, finishedAt: failure.at },
    });
  }

  /** Patches the row of the scope's store unless it is over. */
  private async patchOpen(
    ctx: OperationContext,
    scope: StoreScope,
    change: { readonly id: string; readonly patch: ExportPatch },
  ): Promise<void> {
    const where = { id: change.id, storeId: scope.storeId, status: Not(In([...TERMINAL_JOB_STATUSES])) };
    await this.rows.update(requestScope(ctx, scope), where, change.patch);
  }
}
