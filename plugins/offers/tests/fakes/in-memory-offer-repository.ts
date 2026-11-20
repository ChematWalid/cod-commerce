import type { Snowflake } from '@cod/shared';
import { normaliseCode } from '../../domain/engine/codes';
import { CodeTakenError, NoActiveStoreError, OfferNotFoundError } from '../../domain/errors';
import type { OfferRecord, StoredCode } from '../../domain/offer-record';
import type {
  OfferCodeRepositoryPort,
  OfferListFilter,
  OfferRepositoryPort,
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

  list(_ctx: OperationContext, scope: StoreScope, filter: OfferListFilter): Promise<readonly OfferRecord[]> {
    const offers = this.tables.offerRows.filter((row) => owns(scope, row)).map((row) => row.value);
    const matching = offers.filter((offer) => filter.status === undefined || offer.status === filter.status);
    return Promise.resolve(matching.sort(newestFirst));
  }

  delete(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const before = this.tables.offerRows.length;
    this.tables.offerRows = this.tables.offerRows.filter((row) => !(owns(scope, row) && row.value.id === id));
    this.tables.codeRows = this.tables.codeRows.filter((row) => !(owns(scope, row) && row.value.offerId === id));
    return Promise.resolve(this.tables.offerRows.length < before);
  }

  activeOf(ctx: OperationContext, scope: StoreScope): Promise<readonly OfferRecord[]> {
    return this.list(ctx, scope, { status: 'active' });
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
