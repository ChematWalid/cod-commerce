import type { TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { In } from 'typeorm';
import type { CoreId } from '../domain/core-id';
import type { Highlight } from '../domain/highlight';
import { ConcurrentUpdateError } from '../domain/errors';
import { distinctLinkIds } from '../domain/link-ids';
import type { HighlightRepositoryPort } from '../domain/ports/highlight-repository.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { HighlightEntity } from './highlight.entity';
import { ProductHighlightEntity } from './product-highlight.entity';
import { requestScope } from './request-scope';
import { inStore } from './store-where';
import { onUniqueViolation } from './unique-violation';

function toHighlight(row: HighlightEntity): Highlight {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    storeId: toStoreId(row.storeId ?? ''),
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The Postgres adapter of {@link HighlightRepositoryPort}: `catalog_highlight` and `catalog_product_highlight`
 * through `TenantRepository` (ADR 0002). Link ids come from `ids`; the link's `position` keeps the display order.
 */
export class TypeOrmHighlightRepository implements HighlightRepositoryPort {
  private readonly rows: TenantRepository<HighlightEntity>;
  private readonly links: TenantRepository<ProductHighlightEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: IdGeneratorPort,
  ) {
    this.rows = repositories.for(HighlightEntity);
    this.links = repositories.for(ProductHighlightEntity);
  }

  async insert(ctx: OperationContext, scope: StoreScope, highlight: Highlight): Promise<void> {
    const { id, text, createdAt, updatedAt } = highlight;
    await this.rows.insert(requestScope(ctx, scope), { id, text, createdAt, updatedAt, ...inStore(scope) });
  }

  async findById(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<Highlight | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { ...inStore(scope), id });
    return row === null ? undefined : toHighlight(row);
  }

  async findByIds(ctx: OperationContext, scope: StoreScope, ids: readonly Snowflake[]): Promise<readonly Highlight[]> {
    if (ids.length === 0) return [];
    const rows = await this.rows.find(requestScope(ctx, scope), { where: { ...inStore(scope), id: In([...ids]) } });
    return rows.map(toHighlight);
  }

  async list(ctx: OperationContext, scope: StoreScope): Promise<readonly Highlight[]> {
    const rows = await this.rows.find(requestScope(ctx, scope), {
      where: inStore(scope),
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return rows.map(toHighlight);
  }

  async update(ctx: OperationContext, scope: StoreScope, highlight: Highlight): Promise<boolean> {
    const { text, updatedAt } = highlight;
    const where = { ...inStore(scope), id: highlight.id };
    return (await this.rows.update(requestScope(ctx, scope), where, { text, updatedAt })) > 0;
  }

  async delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const tenant = requestScope(ctx, scope);
    const deleted = await this.rows.delete(tenant, { ...inStore(scope), id });
    if (deleted > 0) await this.links.delete(tenant, { ...inStore(scope), highlightId: id });
    return deleted > 0;
  }

  async replaceProductHighlights(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    highlightIds: readonly Snowflake[],
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    await this.links.delete(tenant, { ...inStore(scope), productId });
    for (const [position, highlightId] of distinctLinkIds(highlightIds).entries()) {
      const link = { id: this.ids.next(), ...inStore(scope), productId, highlightId, position };
      await onUniqueViolation(this.links.insert(tenant, link), () => new ConcurrentUpdateError());
    }
  }

  async highlightIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly Snowflake[]> {
    const rows = await this.links.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), productId },
      order: { position: 'ASC' },
    });
    return rows.map((row) => toSnowflake(row.highlightId));
  }
}
