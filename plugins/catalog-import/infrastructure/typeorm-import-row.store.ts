import {
  SNOWFLAKE_ID_GENERATOR,
  type SnowflakeIdGeneratorPort,
  type TenantRepository,
  TenantRepositoryFactory,
} from '@cod/plugin-tenancy';
import type { ImportRowAction } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { ImportResult } from '../application/ports/import-job.port';
import type { AppliedRows, ImportRowPage, ImportRowStore, StoredImportRow } from '../application/ports/import-row.port';
import type { OperationContext } from '../application/ports/operation-context';
import type { PlannedRow } from '../domain/row-plan';
import type { StoreScope } from '../domain/store-scope';
import { rowDataOf, storedRowOf } from './import-job-rows';
import { ImportRowEntity } from './import-row.entity';
import { requestScope } from './request-context';

const BY_ROW = { rowNumber: 'ASC' } as const;
const APPLIABLE: readonly ImportRowAction[] = ['create', 'update'];

/** A product id as the row stores it (Vendure's integer id). */
// eslint-disable-next-line cod-ids/no-numeric-id -- Vendure core id: an int4 column value, exact as a number
const productIdOf = (id: string | null): number | null => (id === null ? null : Number(id));

/**
 * {@link ImportRowStore} on `catalog_import_row` through `TenantRepository` (ADR 0002): every call matches the scope's
 * business and store and the job named; the job itself was read in the caller's scope first. Joins the transaction
 * `ctx` carries, so a row's `applied` mark commits with its product write (D2210).
 */
@Injectable()
export class TypeOrmImportRowStore implements ImportRowStore {
  private readonly rows: TenantRepository<ImportRowEntity>;

  constructor(
    factory: TenantRepositoryFactory,
    @Inject(SNOWFLAKE_ID_GENERATOR) private readonly ids: SnowflakeIdGeneratorPort,
  ) {
    this.rows = factory.for(ImportRowEntity);
  }

  async replace(ctx: OperationContext, scope: StoreScope, jobId: string, rows: readonly PlannedRow[]): Promise<void> {
    const tenant = requestScope(ctx, scope);
    await this.rows.delete(tenant, { jobId, storeId: scope.storeId });
    for (const row of rows) {
      await this.rows.insert(tenant, {
        id: this.ids.next(),
        storeId: scope.storeId,
        jobId,
        rowNumber: row.rowNumber,
        action: row.action,
        data: rowDataOf(row),
        reasons: [...row.messages],
        productId: productIdOf(row.productId),
        applied: false,
      });
    }
  }

  async page(
    ctx: OperationContext,
    scope: StoreScope,
    jobId: string,
    page: { readonly skip: number; readonly take: number },
  ): Promise<ImportRowPage> {
    const tenant = requestScope(ctx, scope);
    const where = { jobId, storeId: scope.storeId };
    // One after the other: both run on the request's one connection.
    const rows = await this.rows.find(tenant, { where, order: BY_ROW, skip: page.skip, take: page.take });
    const total = await this.rows.count(tenant, where);
    return { rows: rows.map(storedRowOf), total };
  }

  async hasUpdates(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<boolean> {
    return (await this.rows.count(requestScope(ctx, scope), { jobId, storeId: scope.storeId, action: 'update' })) > 0;
  }

  async pending(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<readonly StoredImportRow[]> {
    const where = { jobId, storeId: scope.storeId, applied: false, action: In([...APPLIABLE]) };
    return (await this.rows.find(requestScope(ctx, scope), { where, order: BY_ROW })).map(storedRowOf);
  }

  async failed(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<readonly StoredImportRow[]> {
    const where = { jobId, storeId: scope.storeId, action: 'error' };
    return (await this.rows.find(requestScope(ctx, scope), { where, order: BY_ROW })).map(storedRowOf);
  }

  async markApplied(ctx: OperationContext, scope: StoreScope, applied: AppliedRows): Promise<void> {
    const where = { jobId: applied.jobId, storeId: scope.storeId, rowNumber: In([...applied.rowNumbers]) };
    const outcome =
      applied.failure === undefined
        ? { applied: true, productId: productIdOf(applied.productId) }
        : { applied: true, action: 'error', reasons: [applied.failure] };
    await this.rows.update(requestScope(ctx, scope), where, outcome);
  }

  async resultOf(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<ImportResult> {
    const tenant = requestScope(ctx, scope);
    const base = { jobId, storeId: scope.storeId };
    const created = await this.rows.count(tenant, { ...base, action: 'create', applied: true });
    const updated = await this.rows.count(tenant, { ...base, action: 'update', applied: true });
    const failed = await this.rows.count(tenant, { ...base, action: 'error' });
    return { created, updated, failed };
  }
}
