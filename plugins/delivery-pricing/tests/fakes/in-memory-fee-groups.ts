import { type Snowflake, type StoreId, toSnowflake, type WilayaCode } from '@cod/shared';
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
import type {
  CommuneRowsChange,
  FeeGroupRepositoryPort,
  QuoteRows,
  QuoteRowsQuery,
} from '../../domain/ports/fee-group-repository.port';
import type { CarrierRate } from '../../domain/carrier-prices';
import type { CarrierPriceSyncPort } from '../../domain/ports/carrier-price-sync.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { ProductWeights, ProductWeightsPort } from '../../domain/ports/product-weights.port';
import type { StoreDefaultsPort } from '../../domain/ports/store-defaults.port';
import type { TownDirectoryPort, TownReference } from '../../domain/ports/town-directory.port';
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

  share(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    return Promise.resolve(this.of(scope).has(id));
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

  quoteRows(
    _ctx: OperationContext,
    scope: StoreScope,
    { groupId, provinceCode, codeOns }: QuoteRowsQuery,
  ): Promise<QuoteRows | undefined> {
    const group = this.of(scope).get(groupId);
    if (group === undefined) return Promise.resolve(undefined);
    const rate = group.rates.find((row) => row.provinceCode === provinceCode) ?? null;
    const communeRate =
      codeOns === null
        ? null
        : (group.communeRates.find((row) => row.codeOns === codeOns && row.provinceCode === provinceCode) ?? null);
    return Promise.resolve({ group, rate, communeRate });
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

/**
 * {@link StoreDefaultsPort} over a fixed default group per store key. `stores` are the active stores the converge
 * pages through; linking a store in `failing` throws, as a refused write would. `beforeLock` runs as a concurrent
 * write landing just before the store row is locked; `pageCap` clamps a page as tenancy's directory does.
 */
export class FixedStoreDefaults implements StoreDefaultsPort {
  readonly defaults = new Map<string, Snowflake>();
  /** Each store's language; a store not listed is Arabic, like the platform's demo stores, and `null` is unknown. */
  readonly languages = new Map<string, string | null>();
  readonly stores: StoreScope[] = [];
  readonly failing = new Set<string>();
  readonly links: string[] = [];
  readonly locked: string[] = [];
  beforeLock: ((scope: StoreScope) => void) | undefined;
  pageCap = Number.POSITIVE_INFINITY;

  defaultGroupOf(_ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null> {
    return Promise.resolve(this.defaults.get(keyOf(scope)) ?? null);
  }

  languageOf(_ctx: OperationContext, scope: StoreScope): Promise<string | null> {
    const key = keyOf(scope);
    return Promise.resolve(this.languages.has(key) ? (this.languages.get(key) ?? null) : 'ar');
  }

  lockedDefaultGroupOf(_ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null> {
    this.beforeLock?.(scope);
    this.locked.push(keyOf(scope));
    return Promise.resolve(this.defaults.get(keyOf(scope)) ?? null);
  }

  linkDefaultGroup(_ctx: OperationContext, scope: StoreScope, groupId: Snowflake): Promise<void> {
    if (this.failing.has(keyOf(scope))) return Promise.reject(new Error(`store ${scope.storeId} refused the link`));
    this.defaults.set(keyOf(scope), groupId);
    this.links.push(`${keyOf(scope)}=${groupId}`);
    return Promise.resolve();
  }

  activeStores(
    _ctx: OperationContext,
    afterStoreId: StoreId | undefined,
    limit: number,
  ): Promise<readonly StoreScope[]> {
    const page = this.stores
      .filter((scope) => afterStoreId === undefined || BigInt(scope.storeId) > BigInt(afterStoreId))
      .sort((left, right) => (BigInt(left.storeId) < BigInt(right.storeId) ? -1 : 1))
      .slice(0, Math.min(limit, this.pageCap));
    return Promise.resolve(page);
  }
}

/** {@link TownDirectoryPort} over a fixed map of wilaya → ONS codes; every commune has a stop desk but `noDesk`. */
export class FixedTowns implements TownDirectoryPort {
  constructor(
    private readonly towns: Readonly<Partial<Record<WilayaCode, readonly number[]>>>,
    private readonly noDesk: ReadonlySet<number> = new Set(),
  ) {}

  townsOf(provinceCode: WilayaCode): Promise<readonly number[]> {
    return Promise.resolve(this.towns[provinceCode] ?? []);
  }

  townOf(provinceCode: WilayaCode, codeOns: number): Promise<TownReference | undefined> {
    const known = (this.towns[provinceCode] ?? []).includes(codeOns);
    return Promise.resolve(known ? { isStopdesk: !this.noDesk.has(codeOns), isHomeDelivery: true } : undefined);
  }
}

/**
 * {@link ProductWeightsPort} over a fixed map of product id → grams; records the ids of every read. `unreadable`
 * makes every read answer `'unreadable'`, as the catalog does for a context off the store's channel.
 */
export class FixedWeights implements ProductWeightsPort {
  readonly asked: (readonly string[])[] = [];
  unreadable = false;
  private readonly weights = new Map<string, number | null>();

  set(productId: string, grams: number | null): void {
    this.weights.set(productId, grams);
  }

  weightsOf(_ctx: OperationContext, _scope: StoreScope, productIds: readonly string[]): Promise<ProductWeights> {
    this.asked.push(productIds);
    if (this.unreadable) return Promise.resolve('unreadable');
    const found = productIds
      .filter((id) => this.weights.has(id))
      .map((id) => [id, this.weights.get(id) ?? null] as const);
    return Promise.resolve(new Map(found));
  }
}

/** {@link CarrierPriceSyncPort} answering fixed rates (`null` = the no-op default); records each carrier id asked. */
export class FixedCarrierRates implements CarrierPriceSyncPort {
  readonly asked: (Snowflake | null)[] = [];

  constructor(private readonly rates: readonly CarrierRate[] | null) {}

  ratesFor(
    _ctx: OperationContext,
    _scope: StoreScope,
    carrierId: Snowflake | null,
  ): Promise<readonly CarrierRate[] | null> {
    this.asked.push(carrierId);
    return Promise.resolve(this.rates);
  }
}

export { keyOf as storeKeyOf };
