import { type Snowflake, toSnowflake } from '@cod/shared';
import type { PackRecord, PackStatus } from '../../domain/pack';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { PackRepositoryPort, PackSave } from '../../domain/ports/pack-repository.port';
import type { StoreScope } from '../../domain/store-scope';

const keyOf = (scope: StoreScope): string => `${scope.businessId}:${scope.storeId}`;

/** {@link PackRepositoryPort} in memory, one list per business and store; `reads` logs the businesses read. */
export class InMemoryPackRepository implements PackRepositoryPort {
  private readonly rows = new Map<string, PackRecord[]>();
  private sequence = 0;
  readonly reads: string[] = [];
  /** The context of every pack lookup, in order. */
  readonly readContexts: OperationContext[] = [];

  /** Seeds a stored pack. */
  put(scope: StoreScope, record: PackRecord): void {
    this.rows.set(keyOf(scope), [...this.of(scope).filter((row) => row.productId !== record.productId), record]);
  }

  /** Drops the stored pack of `productId`, as a concurrent writer would. */
  remove(scope: StoreScope, productId: string): void {
    this.rows.set(
      keyOf(scope),
      this.of(scope).filter((row) => row.productId !== productId),
    );
  }

  all(scope: StoreScope): readonly PackRecord[] {
    return this.of(scope);
  }

  findByProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<PackRecord | undefined> {
    this.reads.push(scope.businessId);
    this.readContexts.push(ctx);
    return Promise.resolve(this.of(scope).find((row) => row.productId === productId));
  }

  holding(ctx: OperationContext, scope: StoreScope, productId: string): Promise<readonly PackRecord[]> {
    this.reads.push(scope.businessId);
    this.readContexts.push(ctx);
    return Promise.resolve(this.of(scope).filter((row) => row.components.some((line) => line.productId === productId)));
  }

  save(_ctx: OperationContext, scope: StoreScope, pack: PackSave): Promise<PackRecord> {
    const existing = this.of(scope).find((row) => row.productId === pack.productId);
    this.sequence += 1;
    const id: Snowflake = existing?.id ?? toSnowflake(String(1000 + this.sequence));
    const record: PackRecord = { id, productId: pack.productId, status: pack.status, ...pack.definition };
    this.put(scope, record);
    return Promise.resolve(record);
  }

  setStatus(
    _ctx: OperationContext,
    scope: StoreScope,
    change: { packId: Snowflake; status: PackStatus },
  ): Promise<void> {
    this.rows.set(
      keyOf(scope),
      this.of(scope).map((row) => (row.id === change.packId ? { ...row, status: change.status } : row)),
    );
    return Promise.resolve();
  }

  deleteByProduct(_ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    this.rows.set(
      keyOf(scope),
      this.of(scope).filter((row) => row.productId !== productId),
    );
    return Promise.resolve();
  }

  private of(scope: StoreScope): PackRecord[] {
    return this.rows.get(keyOf(scope)) ?? [];
  }
}
