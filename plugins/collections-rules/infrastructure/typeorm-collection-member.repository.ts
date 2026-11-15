import { type TenantRepository, type TenantRepositoryFactory, tenantQuery } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { In } from 'typeorm';
import { FIRST_MANUAL_POSITION } from '../domain/constants';
import { CollectionNotFoundError } from '../domain/errors';
import { membershipDiff, type MemberRow } from '../domain/membership';
import type {
  CollectionMemberRepositoryPort,
  MemberPlacement,
  ProductMembershipChange,
} from '../domain/ports/collection-member-repository.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { CollectionMemberEntity } from './collection-member.entity';
import { onForeignKeyViolation } from './foreign-key-violation';
import { requestScope } from './request-scope';

/** The order of a collection's members: by position, then newest product first (D2318). */
const MEMBER_ORDER = { position: 'ASC', productId: 'DESC' } as const;

const ALIAS = 'member';

interface CountRow {
  readonly collectionId: number | string;
  readonly members: number | string;
}

interface MaxRow {
  readonly last: number | null;
}

const toMember = (row: CollectionMemberEntity): MemberRow => ({ productId: row.productId, position: row.position });

/**
 * The Postgres adapter of {@link CollectionMemberRepositoryPort} through `TenantRepository` (ADR 0002). Writers hold the
 * store lock (D2334), so a read of the current rows followed by the writes of the difference is never interleaved;
 * inserts skip rows that exist, so a repeat is ignored rather than refused by the unique index.
 */
export class TypeOrmCollectionMemberRepository implements CollectionMemberRepositoryPort {
  private readonly rows: TenantRepository<CollectionMemberEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: IdGeneratorPort,
  ) {
    this.rows = repositories.for(CollectionMemberEntity);
  }

  async membersOf(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<readonly MemberRow[]> {
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: { storeId: scope.storeId, collectionId },
      order: MEMBER_ORDER,
    });
    return rows.map(toMember);
  }

  async replaceMembers(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
    rows: readonly MemberRow[],
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    const current = await this.membersOf(ctx, scope, collectionId);
    const diff = membershipDiff(current, rows);
    const inCollection = { storeId: scope.storeId, collectionId };
    if (diff.remove.length > 0) {
      await this.rows.delete(tenant, { ...inCollection, productId: In([...diff.remove]) });
    }
    for (const moved of diff.update) {
      await this.rows.update(tenant, { ...inCollection, productId: moved.productId }, { position: moved.position });
    }
    for (const added of diff.insert) {
      await this.insert(tenant, scope, { collectionId, position: added.position }, added.productId);
    }
  }

  async setProductIn(
    ctx: OperationContext,
    scope: StoreScope,
    productId: string,
    change: ProductMembershipChange,
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    const ofProduct = { storeId: scope.storeId, productId };
    if (change.out.length > 0) {
      await this.rows.delete(tenant, { ...ofProduct, collectionId: In([...change.out]) });
    }
    if (change.in.length === 0) return;
    const present = await this.rows.find(tenant, {
      where: { ...ofProduct, collectionId: In(change.in.map((placement) => placement.collectionId)) },
      select: { collectionId: true },
    });
    const already = new Set(present.map((row) => row.collectionId));
    for (const placement of change.in.filter((candidate) => !already.has(candidate.collectionId))) {
      await this.insert(tenant, scope, placement, productId);
    }
  }

  async collectionIdsOfProducts(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: { storeId: scope.storeId, productId: In([...productIds]) },
      select: { productId: true, collectionId: true },
    });
    const found = new Map<string, string[]>();
    for (const row of rows) found.set(row.productId, [...(found.get(row.productId) ?? []), row.collectionId]);
    return found;
  }

  async deleteProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    await this.rows.delete(requestScope(ctx, scope), { storeId: scope.storeId, productId });
  }

  async countsOf(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    if (collectionIds.length === 0) return new Map();
    const rows = await tenantQuery(requestScope(ctx, scope), this.rows, ALIAS)
      .select(`${ALIAS}.collectionId`, 'collectionId')
      .addSelect('COUNT(*)', 'members')
      .andWhere(`${ALIAS}.storeId = :storeId`, { storeId: scope.storeId })
      .andWhere(`${ALIAS}.collectionId IN (:...collectionIds)`, { collectionIds: [...collectionIds] })
      .groupBy(`${ALIAS}.collectionId`)
      .getRawMany<CountRow>();
    return new Map(rows.map((row) => [String(row.collectionId), Number(row.members)]));
  }

  async nextPosition(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<number> {
    const row = await tenantQuery(requestScope(ctx, scope), this.rows, ALIAS)
      .select(`MAX(${ALIAS}.position)`, 'last')
      .andWhere(`${ALIAS}.storeId = :storeId`, { storeId: scope.storeId })
      .andWhere(`${ALIAS}.collectionId = :collectionId`, { collectionId })
      .getRawOne<MaxRow>();
    return row?.last === null || row?.last === undefined ? FIRST_MANUAL_POSITION : row.last + 1;
  }

  private async insert(
    tenant: TenantScope,
    scope: StoreScope,
    placement: MemberPlacement,
    productId: string,
  ): Promise<void> {
    const row = { id: this.ids.next(), storeId: scope.storeId, productId, ...placement };
    await onForeignKeyViolation(this.rows.insert(tenant, row), () => new CollectionNotFoundError());
  }
}
