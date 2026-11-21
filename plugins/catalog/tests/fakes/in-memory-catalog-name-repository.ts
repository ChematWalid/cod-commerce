import type { Snowflake } from '@cod/shared';
import { NameTakenError } from '../../domain/errors';
import type { CatalogNameRepositoryPort } from '../../domain/ports/catalog-name-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import type { CatalogNameEntry } from '../../domain/taxonomy';
import { inStore, newestFirst } from './store-rows';

/** Brands or tags in memory, one name key per store as the unique index has; it passes the contract. */
export class InMemoryCatalogNameRepository implements CatalogNameRepositoryPort {
  readonly rows: CatalogNameEntry[] = [];

  protected indexOf(scope: StoreScope, id: Snowflake): number {
    return this.rows.findIndex((row) => inStore(scope, row) && row.id === id);
  }

  private nameTaken(scope: StoreScope, entry: CatalogNameEntry): boolean {
    return this.rows.some((row) => inStore(scope, row) && row.nameKey === entry.nameKey && row.id !== entry.id);
  }

  insert(_ctx: OperationContext, scope: StoreScope, entry: CatalogNameEntry): Promise<void> {
    if (this.nameTaken(scope, entry)) return Promise.reject(new NameTakenError());
    this.rows.push({ ...entry, businessId: scope.businessId, storeId: scope.storeId });
    return Promise.resolve();
  }

  findById(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<CatalogNameEntry | undefined> {
    return Promise.resolve(this.rows[this.indexOf(scope, id)]);
  }

  findByIds(
    _ctx: OperationContext,
    scope: StoreScope,
    ids: readonly Snowflake[],
  ): Promise<readonly CatalogNameEntry[]> {
    return Promise.resolve(this.rows.filter((row) => inStore(scope, row) && ids.includes(row.id)));
  }

  findByNameKey(_ctx: OperationContext, scope: StoreScope, nameKey: string): Promise<CatalogNameEntry | undefined> {
    return Promise.resolve(this.rows.find((row) => inStore(scope, row) && row.nameKey === nameKey));
  }

  count(_ctx: OperationContext, scope: StoreScope): Promise<number> {
    return Promise.resolve(this.rows.filter((row) => inStore(scope, row)).length);
  }

  list(_ctx: OperationContext, scope: StoreScope): Promise<readonly CatalogNameEntry[]> {
    return Promise.resolve(newestFirst(this.rows.filter((row) => inStore(scope, row))));
  }

  update(_ctx: OperationContext, scope: StoreScope, entry: CatalogNameEntry): Promise<boolean> {
    const index = this.indexOf(scope, entry.id);
    if (index < 0) return Promise.resolve(false);
    if (this.nameTaken(scope, entry)) return Promise.reject(new NameTakenError());
    const stored = this.rows[index] as CatalogNameEntry;
    this.rows.splice(index, 1, { ...stored, name: entry.name, nameKey: entry.nameKey, updatedAt: entry.updatedAt });
    return Promise.resolve(true);
  }

  delete(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const index = this.indexOf(scope, id);
    if (index < 0) return Promise.resolve(false);
    this.rows.splice(index, 1);
    return Promise.resolve(true);
  }
}
