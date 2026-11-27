import { type TenantRepository, type TenantRepositoryFactory, tenantQuery } from '@cod/plugin-tenancy';
import type { ObjectLiteral } from 'typeorm';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProjectionPage } from '../domain/ports/projection-repository.port';
import type { SearchPageRequest, StorefrontSearchPort } from '../domain/ports/storefront-search.port';
import type { StoreScope } from '../domain/store-scope';
import { requestScope } from './request-scope';
import { StorefrontProductEntity } from './storefront-product.entity';
import { toProjectionRow } from './typeorm-projection.repository';

const ALIAS = 'product';
const SEARCH_TEXT = `"${ALIAS}"."searchText"`;
const BASE_MATCH = 'search_base_match';
const RANK = 'search_rank';

/** The text parameter of variant `index`: typed, so `||` and the trigram operators resolve on `text`. */
const variantOf = (index: number): string => `CAST(:searchVariant${String(index)} AS text)`;

/** Word similarity at or above `pg_trgm.word_similarity_threshold`: the operator the trigram GIN index serves. */
const matchOf = (index: number): string => `${variantOf(index)} <% ${SEARCH_TEXT}`;

/**
 * How well one variant matches a row: 2 for an exact word (the variant between spaces), 1 for a word prefix, plus its
 * word similarity (0 to 1), so ties inside a class go to the closer text (ADR 0014: exact > prefix > trigram).
 */
const scoreOf = (index: number): string => {
  const variant = variantOf(index);
  const exact = `position(' ' || ${variant} || ' ' IN ' ' || ${SEARCH_TEXT} || ' ') > 0`;
  const prefix = `position(' ' || ${variant} IN ' ' || ${SEARCH_TEXT}) > 0`;
  return `(CASE WHEN ${exact} THEN 2 WHEN ${prefix} THEN 1 ELSE 0 END + word_similarity(${variant}, ${SEARCH_TEXT}))`;
};

const parametersOf = (variants: readonly string[]): ObjectLiteral =>
  Object.fromEntries(variants.map((variant, index) => [`searchVariant${String(index)}`, variant]));

/**
 * The Postgres adapter of {@link StorefrontSearchPort} (ADR 0014 Phase 1, spike E variant b″): `word_similarity`
 * (`<%`) of each variant against the row's `searchText`, through `TenantRepository`'s query builder, so the business
 * filter comes first and the store and `listed` filters follow before any trigram is compared. The variants are bound
 * parameters; only their count shapes the SQL.
 */
export class TypeOrmStorefrontSearch implements StorefrontSearchPort {
  private readonly rows: TenantRepository<StorefrontProductEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(StorefrontProductEntity);
  }

  async search(
    ctx: OperationContext,
    scope: StoreScope,
    variants: readonly string[],
    page: SearchPageRequest,
  ): Promise<ProjectionPage> {
    if (variants.length === 0) return { items: [], totalItems: 0 };
    const indexes = variants.map((_, index) => index);
    const query = tenantQuery(requestScope(ctx, scope), this.rows, ALIAS)
      .andWhere(`${ALIAS}.storeId = :storeId`, { storeId: scope.storeId })
      .andWhere(`${ALIAS}.listed = true`)
      .andWhere(indexes.map(matchOf).join(' OR '), parametersOf(variants))
      .addSelect(`CASE WHEN ${matchOf(0)} THEN 1 ELSE 0 END`, BASE_MATCH)
      .addSelect(`GREATEST(${indexes.map(scoreOf).join(', ')})`, RANK)
      .orderBy(BASE_MATCH, 'DESC')
      .addOrderBy(RANK, 'DESC')
      .addOrderBy(`${ALIAS}.createdAt`, 'DESC')
      .addOrderBy(`${ALIAS}.productId`, 'DESC');
    const [items, totalItems] = await query.offset(page.skip).limit(page.take).getManyAndCount();
    return { items: items.map(toProjectionRow), totalItems };
  }
}
