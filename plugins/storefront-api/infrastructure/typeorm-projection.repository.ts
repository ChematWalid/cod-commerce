import type { SnowflakeIdGeneratorPort, TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { tenantQuery } from '@cod/plugin-tenancy';
import type { SoldOutBehavior, StorefrontSort } from '@cod/shared';
import { Not } from 'typeorm';
import { canonicalCoreId, canonicalCoreIds } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type {
  ProjectionListing,
  ProjectionPage,
  ProjectionRepositoryPort,
} from '../domain/ports/projection-repository.port';
import type { ProjectionRow } from '../domain/projection-row';
import type { StoreScope } from '../domain/store-scope';
import { requestScope } from './request-scope';
import { StorefrontProductEntity } from './storefront-product.entity';

const ALIAS = 'product';

/** Each list order, with the product id as tie-break so pages never repeat or skip a row. */
const ORDERS: Readonly<Record<StorefrontSort, readonly [string, 'ASC' | 'DESC'][]>> = {
  newest: [
    [`${ALIAS}.createdAt`, 'DESC'],
    [`${ALIAS}.productId`, 'DESC'],
  ],
  'price-asc': [
    [`${ALIAS}.price`, 'ASC'],
    [`${ALIAS}.productId`, 'ASC'],
  ],
  'price-desc': [
    [`${ALIAS}.price`, 'DESC'],
    [`${ALIAS}.productId`, 'DESC'],
  ],
};

/**
 * The `listed` rule of `isListed` (domain) as SQL, over the row's own columns: a constant per behaviour, never a
 * value from input.
 */
const LISTED_SQL: Readonly<Record<SoldOutBehavior, string>> = {
  keep: '"visible"',
  hide: '"visible" AND NOT "soldOut"',
};

const toRow = (entity: StorefrontProductEntity): ProjectionRow => ({
  productId: entity.productId,
  slug: entity.slug,
  name: entity.name,
  searchText: entity.searchText,
  price: entity.price,
  oldPrice: entity.oldPrice,
  imagePath: entity.imagePath,
  visible: entity.visible,
  soldOut: entity.soldOut,
  listed: entity.listed,
  createdAt: entity.createdAt,
});

/** The columns a save writes, named one by one. */
const fieldsOf = (row: ProjectionRow) => ({
  slug: row.slug,
  name: row.name,
  searchText: row.searchText,
  price: row.price,
  oldPrice: row.oldPrice,
  imagePath: row.imagePath,
  visible: row.visible,
  soldOut: row.soldOut,
  listed: row.listed,
  createdAt: row.createdAt,
  updatedAt: () => 'now()',
});

/**
 * The Postgres adapter of {@link ProjectionRepositoryPort} through `TenantRepository` (ADR 0002): every call carries
 * the business and the store. Product ids are made canonical first, so a malformed one never reaches Postgres. Two
 * deliveries saving one new product at once may meet the unique index: the losing one fails and is retried by the
 * outbox, and then updates.
 */
export class TypeOrmProjectionRepository implements ProjectionRepositoryPort {
  private readonly rows: TenantRepository<StorefrontProductEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: SnowflakeIdGeneratorPort,
  ) {
    this.rows = repositories.for(StorefrontProductEntity);
  }

  async save(ctx: OperationContext, scope: StoreScope, row: ProjectionRow): Promise<void> {
    const productId = canonicalCoreId(row.productId);
    if (productId === undefined) return;
    const tenant = requestScope(ctx, scope);
    // Slugs are unique per store in the catalog: a row of another product holding this slug is stale.
    await this.rows.delete(tenant, { storeId: scope.storeId, slug: row.slug, productId: Not(productId) });
    const updated = await this.rows.update(tenant, { storeId: scope.storeId, productId }, fieldsOf(row));
    if (updated > 0) return;
    await this.rows.insert(tenant, { id: this.ids.next(), storeId: scope.storeId, productId, ...fieldsOf(row) });
  }

  async remove(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    const canonical = canonicalCoreId(productId);
    if (canonical === undefined) return;
    await this.rows.delete(requestScope(ctx, scope), { storeId: scope.storeId, productId: canonical });
  }

  relist(ctx: OperationContext, scope: StoreScope, soldOutBehavior: SoldOutBehavior): Promise<number> {
    return this.rows.update(
      requestScope(ctx, scope),
      { storeId: scope.storeId },
      { listed: () => LISTED_SQL[soldOutBehavior], updatedAt: () => 'now()' },
    );
  }

  count(ctx: OperationContext, scope: StoreScope): Promise<number> {
    return this.rows.count(requestScope(ctx, scope), { storeId: scope.storeId });
  }

  async listed(ctx: OperationContext, scope: StoreScope, listing: ProjectionListing): Promise<ProjectionPage> {
    const productIds = listing.productIds === undefined ? undefined : canonicalCoreIds(listing.productIds);
    if (productIds?.length === 0) return { items: [], totalItems: 0 };
    const query = tenantQuery(requestScope(ctx, scope), this.rows, ALIAS)
      .andWhere(`${ALIAS}.storeId = :storeId`, { storeId: scope.storeId })
      .andWhere(`${ALIAS}.listed = true`);
    // One array parameter, however many members a collection has: never an unbounded bind list (#251).
    if (productIds !== undefined) query.andWhere(`${ALIAS}.productId = ANY(:productIds)`, { productIds });
    for (const [column, direction] of ORDERS[listing.sort]) query.addOrderBy(column, direction);
    const [items, totalItems] = await query.offset(listing.skip).limit(listing.take).getManyAndCount();
    return { items: items.map(toRow), totalItems };
  }
}
