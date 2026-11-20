import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { In, Not } from 'typeorm';
import type { JobFailure, JobRef, JobRepositoryPort } from '../application/ports/job-repository.port';
import { TERMINAL_JOB_STATUSES } from '../domain/job-kinds';
import type { StoreScope } from '../domain/store-scope';
import { ExportJobEntity } from './export-job.entity';
import { ImportJobEntity } from './import-job.entity';

const FAILED = 'failed';

/** {@link JobRepositoryPort} on `catalog_import_job` and `catalog_export_job` through `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmJobRepository implements JobRepositoryPort {
  private readonly imports: TenantRepository<ImportJobEntity>;
  private readonly exports: TenantRepository<ExportJobEntity>;

  constructor(factory: TenantRepositoryFactory) {
    this.imports = factory.for(ImportJobEntity);
    this.exports = factory.for(ExportJobEntity);
  }

  async markFailed(scope: StoreScope, ref: JobRef, failure: JobFailure): Promise<void> {
    await this.updateOpen(scope, ref, {
      status: FAILED,
      errorCode: failure.errorCode,
      updatedAt: failure.at,
      finishedAt: failure.at,
    });
  }

  async touch(scope: StoreScope, ref: JobRef, at: Date): Promise<void> {
    await this.updateOpen(scope, ref, { updatedAt: at });
  }

  /** Patches the row of the scope's store unless it is over; another business's or store's row matches nothing. */
  private async updateOpen(
    scope: StoreScope,
    ref: JobRef,
    patch: { status?: string; errorCode?: string; updatedAt: Date; finishedAt?: Date },
  ): Promise<void> {
    const where = { id: ref.id, storeId: scope.storeId, status: Not(In([...TERMINAL_JOB_STATUSES])) };
    if (ref.table === 'import') await this.imports.update(scope, where, patch);
    else await this.exports.update(scope, where, patch);
  }
}
