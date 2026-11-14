import type { TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, toSnowflake } from '@cod/shared';
import { type CoreId, toCoreId } from '../domain/core-id';
import { ConcurrentUpdateError } from '../domain/errors';
import { distinctLinkIds } from '../domain/link-ids';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TagRepositoryPort } from '../domain/ports/tag-repository.port';
import type { StoreScope } from '../domain/store-scope';
import { ProductTagEntity } from './product-tag.entity';
import { requestScope } from './request-scope';
import { inStore } from './store-where';
import { TagEntity } from './tag.entity';
import { TypeOrmCatalogNameRepository } from './typeorm-catalog-name.repository';
import { onUniqueViolation } from './unique-violation';

/**
 * The Postgres adapter of {@link TagRepositoryPort}: `catalog_tag` and `catalog_product_tag` through `TenantRepository`
 * (ADR 0002). Link ids come from `ids`; a call joins the transaction `ctx` carries, so a replace is atomic in one.
 */
export class TypeOrmTagRepository extends TypeOrmCatalogNameRepository implements TagRepositoryPort {
  private readonly links: TenantRepository<ProductTagEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: IdGeneratorPort,
  ) {
    super(repositories.for(TagEntity));
    this.links = repositories.for(ProductTagEntity);
  }

  override async delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const deleted = await super.delete(ctx, scope, id);
    if (deleted) await this.links.delete(requestScope(ctx, scope), { ...inStore(scope), tagId: id });
    return deleted;
  }

  async replaceProductTags(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    tagIds: readonly Snowflake[],
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    await this.links.delete(tenant, { ...inStore(scope), productId });
    for (const tagId of distinctLinkIds(tagIds)) {
      const link = { id: this.ids.next(), ...inStore(scope), productId, tagId };
      await onUniqueViolation(this.links.insert(tenant, link), () => new ConcurrentUpdateError());
    }
  }

  async tagIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly Snowflake[]> {
    const rows = await this.links.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), productId },
      order: { id: 'ASC' },
    });
    return rows.map((row) => toSnowflake(row.tagId));
  }

  async productIdsWithTag(ctx: OperationContext, scope: StoreScope, tagId: Snowflake): Promise<readonly CoreId[]> {
    const rows = await this.links.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), tagId },
      order: { id: 'ASC' },
    });
    return rows.map((row) => toCoreId(row.productId));
  }
}
