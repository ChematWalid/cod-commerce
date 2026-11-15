import type { CollectionDefinition } from '../../domain/collection';
import { CollectionNotFoundError } from '../../domain/errors';
import { membershipDiff, type MemberRow } from '../../domain/membership';
import type {
  CollectionDefinitionRepositoryPort,
  DefinitionListRequest,
  DefinitionPage,
} from '../../domain/ports/collection-definition-repository.port';
import type {
  CollectionMemberRepositoryPort,
  ProductMembershipChange,
} from '../../domain/ports/collection-member-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { newId } from '../support/builders';

interface StoredDefinition {
  readonly businessId: string;
  readonly definition: CollectionDefinition;
}

interface StoredMember extends MemberRow {
  readonly id: string;
  readonly businessId: string;
  readonly storeId: string;
  readonly collectionId: string;
}

const inStore = (scope: StoreScope, row: { businessId: string; storeId: string }): boolean =>
  row.businessId === scope.businessId && row.storeId === scope.storeId;

const byPositionThenId = (left: CollectionDefinition, right: CollectionDefinition): number =>
  left.position - right.position || (BigInt(left.id) < BigInt(right.id) ? -1 : 1);

const byPositionThenNewest = (left: MemberRow, right: MemberRow): number =>
  left.position - right.position || (BigInt(right.productId) > BigInt(left.productId) ? 1 : -1);

/**
 * `collections_definition` and `collections_member` in memory, with the unique keys, the FK and its cascade of the
 * real tables (D2300, D2337); both repositories pass the same contracts as the TypeORM adapters.
 */
export class InMemoryCollectionTables {
  readonly definitionRows: StoredDefinition[] = [];
  readonly memberRows: StoredMember[] = [];
  readonly definitions: CollectionDefinitionRepositoryPort = new InMemoryDefinitions(this);
  readonly members: CollectionMemberRepositoryPort = new InMemoryMembers(this);

  /** The FK: a member needs a definition of the same business and store with that collection id. */
  assertDefined(scope: StoreScope, collectionId: string): void {
    const found = this.definitionRows.some(
      (row) =>
        inStore(scope, { businessId: row.businessId, storeId: row.definition.storeId }) &&
        row.definition.collectionId === collectionId,
    );
    if (!found) throw new CollectionNotFoundError();
  }

  /** The FK's `ON DELETE CASCADE`. */
  cascade(businessId: string, collectionId: string): void {
    this.removeMembers((row) => row.businessId === businessId && row.collectionId === collectionId);
  }

  removeMembers(matches: (row: StoredMember) => boolean): void {
    const kept = this.memberRows.filter((row) => !matches(row));
    this.memberRows.splice(0, this.memberRows.length, ...kept);
  }

  memberRowIds(scope: StoreScope, collectionId: string): ReadonlyMap<string, string> {
    const own = this.memberRows.filter((row) => inStore(scope, row) && row.collectionId === collectionId);
    return new Map(own.map((row) => [row.productId, row.id]));
  }
}

class InMemoryDefinitions implements CollectionDefinitionRepositoryPort {
  constructor(private readonly tables: InMemoryCollectionTables) {}

  private own(scope: StoreScope): CollectionDefinition[] {
    return this.tables.definitionRows
      .filter((row) => inStore(scope, { businessId: row.businessId, storeId: row.definition.storeId }))
      .map((row) => row.definition);
  }

  insert(_ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<void> {
    this.tables.definitionRows.push({
      businessId: scope.businessId,
      definition: { ...definition, storeId: scope.storeId },
    });
    return Promise.resolve();
  }

  findByCollectionId(
    _ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
  ): Promise<CollectionDefinition | undefined> {
    return Promise.resolve(this.own(scope).find((definition) => definition.collectionId === collectionId));
  }

  list(_ctx: OperationContext, scope: StoreScope, request: DefinitionListRequest): Promise<DefinitionPage> {
    const wanted = request.collectionIds === undefined ? undefined : new Set(request.collectionIds);
    const matching = this.own(scope)
      .filter((definition) => wanted === undefined || wanted.has(definition.collectionId))
      .sort(byPositionThenId);
    const items = matching.slice(request.skip, request.skip + request.take);
    return Promise.resolve({ items, totalItems: matching.length });
  }

  listAutomatic(_ctx: OperationContext, scope: StoreScope): Promise<readonly CollectionDefinition[]> {
    return Promise.resolve(this.own(scope).filter((definition) => definition.mode === 'automatic'));
  }

  existing(_ctx: OperationContext, scope: StoreScope, collectionIds: readonly string[]): Promise<readonly string[]> {
    const own = new Set(this.own(scope).map((definition) => definition.collectionId));
    return Promise.resolve(collectionIds.filter((collectionId) => own.has(collectionId)));
  }

  update(_ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<boolean> {
    const index = this.indexOf(scope, definition.collectionId);
    if (index < 0) return Promise.resolve(false);
    this.tables.definitionRows[index] = {
      businessId: scope.businessId,
      definition: { ...definition, storeId: scope.storeId },
    };
    return Promise.resolve(true);
  }

  delete(_ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<boolean> {
    const index = this.indexOf(scope, collectionId);
    if (index < 0) return Promise.resolve(false);
    this.tables.definitionRows.splice(index, 1);
    this.tables.cascade(scope.businessId, collectionId);
    return Promise.resolve(true);
  }

  countInStore(_ctx: OperationContext, scope: StoreScope): Promise<number> {
    return Promise.resolve(this.own(scope).length);
  }

  private indexOf(scope: StoreScope, collectionId: string): number {
    return this.tables.definitionRows.findIndex(
      (row) =>
        inStore(scope, { businessId: row.businessId, storeId: row.definition.storeId }) &&
        row.definition.collectionId === collectionId,
    );
  }
}

class InMemoryMembers implements CollectionMemberRepositoryPort {
  constructor(private readonly tables: InMemoryCollectionTables) {}

  private rowsOf(scope: StoreScope, collectionId: string): StoredMember[] {
    return this.tables.memberRows.filter((row) => inStore(scope, row) && row.collectionId === collectionId);
  }

  private add(scope: StoreScope, collectionId: string, member: MemberRow): void {
    this.tables.assertDefined(scope, collectionId);
    const { businessId, storeId } = scope;
    this.tables.memberRows.push({ id: newId(), businessId, storeId, collectionId, ...member });
  }

  membersOf(_ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<readonly MemberRow[]> {
    const rows = this.rowsOf(scope, collectionId).map(({ productId, position }) => ({ productId, position }));
    return Promise.resolve(rows.sort(byPositionThenNewest));
  }

  replaceMembers(
    _ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
    rows: readonly MemberRow[],
  ): Promise<void> {
    // Settled later, like a database call: a refusal rejects the promise instead of throwing at the call.
    return Promise.resolve().then(() => {
      this.replaceNow(scope, collectionId, rows);
    });
  }

  /** Like the table, only an inserted row meets the FK. */
  private replaceNow(scope: StoreScope, collectionId: string, rows: readonly MemberRow[]): void {
    const current = this.rowsOf(scope, collectionId);
    const diff = membershipDiff(current, rows);
    const removed = new Set(diff.remove);
    this.tables.removeMembers((row) => current.includes(row) && removed.has(row.productId));
    for (const moved of diff.update) {
      const index = this.tables.memberRows.findIndex(
        (row) => current.includes(row) && row.productId === moved.productId,
      );
      const row = this.tables.memberRows[index];
      if (row !== undefined) this.tables.memberRows[index] = { ...row, position: moved.position };
    }
    for (const added of diff.insert) this.add(scope, collectionId, added);
  }

  setProductIn(
    _ctx: OperationContext,
    scope: StoreScope,
    productId: string,
    change: ProductMembershipChange,
  ): Promise<void> {
    return Promise.resolve().then(() => {
      this.setNow(scope, productId, change);
    });
  }

  private setNow(scope: StoreScope, productId: string, change: ProductMembershipChange): void {
    const out = new Set(change.out);
    this.tables.removeMembers((row) => inStore(scope, row) && row.productId === productId && out.has(row.collectionId));
    for (const { collectionId, position } of change.in) {
      const present = this.rowsOf(scope, collectionId).some((row) => row.productId === productId);
      if (!present) this.add(scope, collectionId, { productId, position });
    }
  }

  collectionIdsOfProducts(
    _ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const wanted = new Set(productIds);
    const found = new Map<string, string[]>();
    for (const row of this.tables.memberRows) {
      if (!inStore(scope, row) || !wanted.has(row.productId)) continue;
      found.set(row.productId, [...(found.get(row.productId) ?? []), row.collectionId]);
    }
    return Promise.resolve(found);
  }

  deleteProduct(_ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    this.tables.removeMembers((row) => inStore(scope, row) && row.productId === productId);
    return Promise.resolve();
  }

  countsOf(
    _ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    for (const collectionId of collectionIds) {
      const count = this.rowsOf(scope, collectionId).length;
      if (count > 0) counts.set(collectionId, count);
    }
    return Promise.resolve(counts);
  }

  nextPosition(_ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<number> {
    const positions = this.rowsOf(scope, collectionId).map((row) => row.position);
    return Promise.resolve(positions.length === 0 ? 0 : Math.max(...positions) + 1);
  }
}
