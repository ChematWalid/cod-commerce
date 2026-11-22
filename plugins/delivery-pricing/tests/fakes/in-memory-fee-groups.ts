import { type Snowflake, toSnowflake, type WilayaCode } from '@cod/shared';
import type {
  CommuneRateRow,
  FeeGroupHeader,
  FeeGroupListQuery,
  FeeGroupPage,
  FeeGroupRecord,
  FeeGroupSettings,
  NewFeeGroup,
  WilayaRateRow,
} from '../../domain/fee-group';
import type { CommuneRowsChange, FeeGroupRepositoryPort } from '../../domain/ports/fee-group-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreDefaultsPort } from '../../domain/ports/store-defaults.port';
import type { TownDirectoryPort } from '../../domain/ports/town-directory.port';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import type { StoreScope } from '../../domain/store-scope';

const keyOf = (scope: StoreScope): string => `${scope.businessId}:${scope.storeId}`;

/** {@link FeeGroupRepositoryPort} in memory, one map per `(businessId, storeId)`; records the ids it locked. */
export class InMemoryFeeGroups implements FeeGroupRepositoryPort {
  readonly locked: Snowflake[] = [];
  private readonly stores = new Map<string, Map<Snowflake, FeeGroupRecord>>();
  private next = 1000000000000000000n;
  private clock = Date.UTC(2026, 10, 22);

  list(_ctx: OperationContext, scope: StoreScope, query: FeeGroupListQuery): Promise<FeeGroupPage> {
    const all = [...this.of(scope).values()]
      .filter((group) => query.search === undefined || group.name.toLowerCase().includes(query.search.toLowerCase()))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    return Promise.resolve({ items: all.slice(query.skip, query.skip + query.take), totalItems: all.length });
  }

  find(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupRecord | undefined> {
    return Promise.resolve(this.of(scope).get(id));
  }

  lock(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupHeader | undefined> {
    this.locked.push(id);
    return Promise.resolve(this.of(scope).get(id));
  }

  platformDefaultId(_ctx: OperationContext, scope: StoreScope): Promise<Snowflake | undefined> {
    return Promise.resolve([...this.of(scope).values()].find((group) => group.isPlatformDefault)?.id);
  }

  insert(_ctx: OperationContext, scope: StoreScope, group: NewFeeGroup): Promise<Snowflake> {
    this.next += 1n;
    this.clock += 1000;
    const id = toSnowflake(String(this.next));
    const now = new Date(this.clock);
    this.of(scope).set(id, { ...group, id, createdAt: now, updatedAt: now, communeRates: [] });
    return Promise.resolve(id);
  }

  update(
    _ctx: OperationContext,
    scope: StoreScope,
    id: Snowflake,
    change: { settings: FeeGroupSettings; rates: readonly WilayaRateRow[] },
  ): Promise<void> {
    const group = this.of(scope).get(id);
    if (group !== undefined) this.of(scope).set(id, { ...group, ...change.settings, rates: change.rates });
    return Promise.resolve();
  }

  delete(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<void> {
    this.of(scope).delete(id);
    return Promise.resolve();
  }

  communeRows(
    _ctx: OperationContext,
    scope: StoreScope,
    groupId: Snowflake,
    provinceCode: WilayaCode,
  ): Promise<readonly CommuneRateRow[]> {
    const rows = this.of(scope).get(groupId)?.communeRates ?? [];
    return Promise.resolve(rows.filter((row) => row.provinceCode === provinceCode));
  }

  writeCommuneRows(
    _ctx: OperationContext,
    scope: StoreScope,
    groupId: Snowflake,
    change: CommuneRowsChange,
  ): Promise<void> {
    const group = this.of(scope).get(groupId);
    if (group === undefined) return Promise.resolve();
    const touched = new Set([...change.removals, ...change.upserts.map((row) => row.codeOns)]);
    const kept = group.communeRates.filter((row) => !touched.has(row.codeOns));
    this.of(scope).set(groupId, { ...group, communeRates: [...kept, ...change.upserts] });
    return Promise.resolve();
  }

  /** Test arrangement: sets a stored commune row as a carrier sync would (bases included). */
  seedCommuneRow(scope: StoreScope, groupId: Snowflake, row: CommuneRateRow): void {
    const group = this.of(scope).get(groupId);
    if (group !== undefined) this.of(scope).set(groupId, { ...group, communeRates: [...group.communeRates, row] });
  }

  private of(scope: StoreScope): Map<Snowflake, FeeGroupRecord> {
    const existing = this.stores.get(keyOf(scope));
    if (existing !== undefined) return existing;
    const created = new Map<Snowflake, FeeGroupRecord>();
    this.stores.set(keyOf(scope), created);
    return created;
  }
}

/** Runs the work at once, with the same context. */
export const inlineTransaction: TransactionPort = {
  run: (ctx, _scope, work) => work(ctx),
};

/** {@link StoreDefaultsPort} answering a fixed default group per store key. */
export class FixedStoreDefaults implements StoreDefaultsPort {
  readonly defaults = new Map<string, Snowflake>();

  defaultGroupOf(_ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null> {
    return Promise.resolve(this.defaults.get(keyOf(scope)) ?? null);
  }
}

/** {@link TownDirectoryPort} over a fixed map of wilaya → ONS codes. */
export class FixedTowns implements TownDirectoryPort {
  constructor(private readonly towns: Readonly<Partial<Record<WilayaCode, readonly number[]>>>) {}

  townsOf(provinceCode: WilayaCode): Promise<readonly number[]> {
    return Promise.resolve(this.towns[provinceCode] ?? []);
  }
}

export { keyOf as storeKeyOf };
