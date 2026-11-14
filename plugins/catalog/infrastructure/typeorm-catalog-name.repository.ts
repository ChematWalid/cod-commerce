import type { TenantEntity, TenantRepository } from '@cod/plugin-tenancy';
import { type Snowflake, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { In } from 'typeorm';
import type { CatalogNameRepositoryPort } from '../domain/ports/catalog-name-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CatalogNameEntry } from '../domain/taxonomy';
import { translateNameTaken } from './name-taken';
import { requestScope } from './request-scope';
import { inStore } from './store-where';

/** The columns `catalog_brand` and `catalog_tag` share. */
export interface CatalogNameRow extends TenantEntity {
  id: string;
  name: string;
  nameKey: string;
  createdAt: Date;
  updatedAt: Date;
}

function toEntry(row: CatalogNameRow): CatalogNameEntry {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    storeId: toStoreId(row.storeId ?? ''),
    name: row.name,
    nameKey: row.nameKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The Postgres adapter of {@link CatalogNameRepositoryPort} over one of the two name tables, on `TenantRepository`. */
export class TypeOrmCatalogNameRepository implements CatalogNameRepositoryPort {
  constructor(protected readonly rows: TenantRepository<CatalogNameRow>) {}

  async insert(ctx: OperationContext, scope: StoreScope, entry: CatalogNameEntry): Promise<void> {
    const { id, name, nameKey, createdAt, updatedAt } = entry;
    const row = { id, name, nameKey, createdAt, updatedAt, ...inStore(scope) };
    await translateNameTaken(this.rows.insert(requestScope(ctx, scope), row));
  }

  async findById(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<CatalogNameEntry | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { ...inStore(scope), id });
    return row === null ? undefined : toEntry(row);
  }

  async findByIds(
    ctx: OperationContext,
    scope: StoreScope,
    ids: readonly Snowflake[],
  ): Promise<readonly CatalogNameEntry[]> {
    if (ids.length === 0) return [];
    const rows = await this.rows.find(requestScope(ctx, scope), { where: { ...inStore(scope), id: In([...ids]) } });
    return rows.map(toEntry);
  }

  async findByNameKey(
    ctx: OperationContext,
    scope: StoreScope,
    nameKey: string,
  ): Promise<CatalogNameEntry | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { ...inStore(scope), nameKey });
    return row === null ? undefined : toEntry(row);
  }

  async list(ctx: OperationContext, scope: StoreScope): Promise<readonly CatalogNameEntry[]> {
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: inStore(scope),
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return rows.map(toEntry);
  }

  async update(ctx: OperationContext, scope: StoreScope, entry: CatalogNameEntry): Promise<boolean> {
    const { name, nameKey, updatedAt } = entry;
    const where = { ...inStore(scope), id: entry.id };
    const changed = await translateNameTaken(
      this.rows.update(requestScope(ctx, scope), where, { name, nameKey, updatedAt }),
    );
    return changed > 0;
  }

  async delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const deleted = await this.rows.delete(requestScope(ctx, scope), { ...inStore(scope), id });
    return deleted > 0;
  }
}
