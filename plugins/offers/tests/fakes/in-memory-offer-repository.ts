import type { OfferStatus, Snowflake } from '@cod/shared';
import { normaliseCode } from '../../domain/engine/codes';
import { CodeTakenError, NoActiveStoreError, OfferNotFoundError } from '../../domain/errors';
import type { OfferRecord, StoredCode } from '../../domain/offer-record';
import type {
  OfferCodeRepositoryPort,
  OfferListFilter,
  OfferPage,
  OfferRepositoryPort,
  OfferTargetRefs,
} from '../../domain/ports/offer-repository.port';
import type { OfferUsageCounterPort } from '../../domain/ports/offer-usage-counter.port';
import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';

/** A row of one business and one store, as every offers table row is. */
interface Owned<T> {
  readonly businessId: string;
  readonly storeId: string;
  readonly value: T;
}

const owns = (scope: StoreScope, row: Owned<unknown>): boolean =>
  row.businessId === scope.businessId && row.storeId === scope.storeId;

/** Offers and codes belong to a store (D2405): a scope without one is refused like the `storeId` check does. */
const lacksStore = (scope: StoreScope): boolean => !scope.storeId;

const newestFirst = (left: OfferRecord, right: OfferRecord): number =>
  right.createdAt.getTime() - left.createdAt.getTime() || (BigInt(right.id) > BigInt(left.id) ? 1 : -1);

/** Whether `offer` has a target, of any role, on one of the products or variants of `refs` (D2513). */
const targetsOneOf = (offer: OfferRecord, refs: OfferTargetRefs): boolean =>
  offer.targets.some(
    ({ refType, refId }) =>
      (refType === 'product' && refs.productIds.includes(refId)) ||
      (refType === 'variant' && refs.variantIds.includes(refId)),
  );

/** Whether `offer` passes every filter `filter` sets. */
const matches = (offer: OfferRecord, { status, kind, refs }: OfferListFilter): boolean =>
  (status === undefined || offer.status === status) &&
  (kind === undefined || offer.kind === kind) &&
  (refs === undefined || targetsOneOf(offer, refs));

/** The store's offers in memory; it passes the offer repository contract. */
export class InMemoryOfferRepository implements OfferRepositoryPort {
  constructor(private readonly tables: InMemoryOfferTables) {}

  create(_ctx: OperationContext, scope: StoreScope, offer: OfferRecord): Promise<void> {
    if (lacksStore(scope)) return Promise.reject(new NoActiveStoreError());
    this.tables.offerRows.push({ ...scope, value: offer });
    return Promise.resolve();
  }

  update(_ctx: OperationContext, scope: StoreScope, offer: OfferRecord, expectedVersion: number): Promise<boolean> {
    const index = this.tables.offerRows.findIndex((row) => owns(scope, row) && row.value.id === offer.id);
    const current = this.tables.offerRows[index];
    if (current?.value.version !== expectedVersion) return Promise.resolve(false);
    const { createdAt, usageCount } = current.value;
    this.tables.offerRows[index] = { ...current, value: { ...offer, createdAt, usageCount } };
    return Promise.resolve(true);
  }

  findById(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<OfferRecord | undefined> {
    return Promise.resolve(this.tables.offerOf(scope, id));
  }

  list(_ctx: OperationContext, scope: StoreScope, filter: OfferListFilter): Promise<OfferPage> {
    const matching = this.offersOf(scope).filter((offer) => matches(offer, filter));
    const items = matching.sort(newestFirst).slice(filter.skip, filter.skip + filter.take);
    return Promise.resolve({ items, totalItems: matching.length });
  }

  delete(_ctx: OperationContext, scope: StoreScope, id: Snowflake, status?: OfferStatus): Promise<boolean> {
    const before = this.tables.offerRows.length;
    const doomed = (offer: OfferRecord): boolean =>
      offer.id === id && (status === undefined || offer.status === status);
    if (!this.offersOf(scope).some(doomed)) return Promise.resolve(false);
    this.tables.offerRows = this.tables.offerRows.filter((row) => !(owns(scope, row) && doomed(row.value)));
    this.tables.codeRows = this.tables.codeRows.filter((row) => !(owns(scope, row) && row.value.offerId === id));
    return Promise.resolve(this.tables.offerRows.length < before);
  }

  activeOf(_ctx: OperationContext, scope: StoreScope): Promise<readonly OfferRecord[]> {
    return Promise.resolve(
      this.offersOf(scope)
        .filter((offer) => offer.status === 'active')
        .sort(newestFirst),
    );
  }

  private offersOf(scope: StoreScope): OfferRecord[] {
    return this.tables.offerRows.filter((row) => owns(scope, row)).map((row) => row.value);
  }
}

/** The store's codes in memory; it passes the code repository contract. */
export class InMemoryOfferCodeRepository implements OfferCodeRepositoryPort {
  constructor(private readonly tables: InMemoryOfferTables) {}

  add(_ctx: OperationContext, scope: StoreScope, codes: readonly StoredCode[]): Promise<void> {
    if (lacksStore(scope)) return Promise.reject(new NoActiveStoreError());
    if (codes.some((code) => this.tables.offerOf(scope, code.offerId) === undefined)) {
      return Promise.reject(new OfferNotFoundError());
    }
    const texts = [...this.codesOf(scope).map((code) => code.code), ...codes.map((code) => code.code)];
    if (new Set(texts).size < texts.length) return Promise.reject(new CodeTakenError());
    this.tables.codeRows.push(...codes.map((value) => ({ ...scope, value })));
    return Promise.resolve();
  }

  remove(_ctx: OperationContext, scope: StoreScope, offerId: Snowflake, code: string): Promise<boolean> {
    const before = this.tables.codeRows.length;
    const text = normaliseCode(code);
    this.tables.codeRows = this.tables.codeRows.filter(
      (row) => !(owns(scope, row) && row.value.offerId === offerId && row.value.code === text),
    );
    return Promise.resolve(this.tables.codeRows.length < before);
  }

  listOf(_ctx: OperationContext, scope: StoreScope, offerId: Snowflake): Promise<readonly StoredCode[]> {
    const codes = this.codesOf(scope).filter((code) => code.offerId === offerId);
    return Promise.resolve(codes.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()));
  }

  countByOffer(
    _ctx: OperationContext,
    scope: StoreScope,
    offerIds: readonly Snowflake[],
  ): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    for (const { offerId } of this.codesOf(scope).filter((code) => offerIds.includes(code.offerId))) {
      counts.set(offerId, (counts.get(offerId) ?? 0) + 1);
    }
    return Promise.resolve(counts);
  }

  findByCodes(_ctx: OperationContext, scope: StoreScope, codes: readonly string[]): Promise<readonly StoredCode[]> {
    const wanted = new Set(codes.map(normaliseCode));
    return Promise.resolve(this.codesOf(scope).filter((code) => wanted.has(code.code)));
  }

  private codesOf(scope: StoreScope): StoredCode[] {
    return this.tables.codeRows.filter((row) => owns(scope, row)).map((row) => row.value);
  }
}

/** The use counts in memory; it passes the usage counter contract (D2447). */
export class InMemoryOfferUsageCounter implements OfferUsageCounterPort {
  constructor(private readonly tables: InMemoryOfferTables) {}

  recordOfferUse(_ctx: OperationContext, scope: StoreScope, offerId: string): Promise<boolean> {
    return Promise.resolve(this.tables.countOffer(scope, offerId, 1));
  }

  recordCodeUse(_ctx: OperationContext, scope: StoreScope, code: string): Promise<boolean> {
    return Promise.resolve(this.tables.countCode(scope, code, 1));
  }

  releaseOfferUse(_ctx: OperationContext, scope: StoreScope, offerId: string): Promise<boolean> {
    return Promise.resolve(this.tables.countOffer(scope, offerId, -1));
  }

  releaseCodeUse(_ctx: OperationContext, scope: StoreScope, code: string): Promise<boolean> {
    return Promise.resolve(this.tables.countCode(scope, code, -1));
  }
}

/** A count moved by `step` when it stays within 0 and the limit; `undefined` when it would leave them. */
function moved(count: number, limit: number | null, step: 1 | -1): number | undefined {
  const next = count + step;
  if (next < 0 || (limit !== null && next > limit)) return undefined;
  return next;
}

/** The offers tables in memory, shared by both fakes so deleting an offer drops its codes, as the cascade does. */
export class InMemoryOfferTables {
  offerRows: Owned<OfferRecord>[] = [];
  codeRows: Owned<StoredCode>[] = [];
  readonly offers = new InMemoryOfferRepository(this);
  readonly codes = new InMemoryOfferCodeRepository(this);
  readonly usage = new InMemoryOfferUsageCounter(this);

  offerOf(scope: StoreScope, id: string): OfferRecord | undefined {
    return this.offerRows.find((row) => owns(scope, row) && row.value.id === id)?.value;
  }

  /** Moves the offer's use count by `step` within 0 and its total limit; `false` when it cannot. */
  countOffer(scope: StoreScope, offerId: string, step: 1 | -1): boolean {
    const index = this.offerRows.findIndex((row) => owns(scope, row) && row.value.id === offerId);
    const row = this.offerRows[index];
    const next = row === undefined ? undefined : moved(row.value.usageCount, row.value.totalUsageLimit, step);
    if (row === undefined || next === undefined) return false;
    this.offerRows[index] = { ...row, value: { ...row.value, usageCount: next } };
    return true;
  }

  /** Moves the code's use count by `step` within 0 and its limit; `false` when it cannot. */
  countCode(scope: StoreScope, code: string, step: 1 | -1): boolean {
    const text = normaliseCode(code);
    const index = this.codeRows.findIndex((row) => owns(scope, row) && row.value.code === text);
    const row = this.codeRows[index];
    const next = row === undefined ? undefined : moved(row.value.usageCount, row.value.usageLimit, step);
    if (row === undefined || next === undefined) return false;
    this.codeRows[index] = { ...row, value: { ...row.value, usageCount: next } };
    return true;
  }
}
