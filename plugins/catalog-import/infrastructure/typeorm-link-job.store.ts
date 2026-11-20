import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { ImportJobKind } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { LinkImportRecord, LinkJobStore, NewLinkImport } from '../application/ports/link-job.port';
import type { OperationContext } from '../application/ports/operation-context';
import { PROGRESS_DONE } from '../domain/constants';
import type { StoreScope } from '../domain/store-scope';
import { ImportJobEntity } from './import-job.entity';
import { requestScope } from './request-context';

/** The kind of every row this store reads and writes; spreadsheet imports are another store's (D2210). */
const LINK: ImportJobKind = 'link';

const recordOf = (row: ImportJobEntity): LinkImportRecord => ({
  id: row.id,
  status: row.status,
  sourceUrl: row.sourceUrl ?? '',
  productId: row.productId === null ? null : String(row.productId),
});

/**
 * {@link LinkJobStore} on `catalog_import_job` through `TenantRepository` (ADR 0002): every call matches the scope's
 * business and store and the `link` kind only, and joins the transaction `ctx` carries. A link import is synchronous,
 * so its row is written once, `done`, with the product it made (D2214).
 */
@Injectable()
export class TypeOrmLinkJobStore implements LinkJobStore {
  private readonly rows: TenantRepository<ImportJobEntity>;

  constructor(factory: TenantRepositoryFactory) {
    this.rows = factory.for(ImportJobEntity);
  }

  async create(ctx: OperationContext, scope: StoreScope, job: NewLinkImport): Promise<void> {
    await this.rows.insert(requestScope(ctx, scope), {
      id: job.id,
      storeId: scope.storeId,
      kind: LINK,
      status: 'done',
      sourceUrl: job.sourceUrl,
      productId: Number(job.productId),
      rowCount: 1,
      progress: PROGRESS_DONE,
      actorAdministratorId: job.actorAdministratorId,
      createdAt: job.at,
      updatedAt: job.at,
      finishedAt: job.at,
    });
  }

  async byId(ctx: OperationContext, scope: StoreScope, id: string): Promise<LinkImportRecord | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { id, storeId: scope.storeId, kind: LINK });
    return row === null ? undefined : recordOf(row);
  }
}
