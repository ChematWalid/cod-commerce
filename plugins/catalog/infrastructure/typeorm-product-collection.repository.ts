import type { TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type CoreId, toCoreId } from '../domain/core-id';
import { distinctLinkIds } from '../domain/link-ids';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductCollectionRepositoryPort } from '../domain/ports/product-collection-repository.port';
import type { StoreScope } from '../domain/store-scope';
import { ProductCollectionEntity } from './product-collection.entity';
import { requestScope } from './request-scope';
import { inStore } from './store-where';

/** The Postgres adapter of {@link ProductCollectionRepositoryPort} through `TenantRepository` (ADR 0002). */
export class TypeOrmProductCollectionRepository implements ProductCollectionRepositoryPort {
  private readonly links: TenantRepository<ProductCollectionEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: IdGeneratorPort,
  ) {
    this.links = repositories.for(ProductCollectionEntity);
  }

  async replaceProductCollections(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    collectionIds: readonly CoreId[],
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    await this.links.delete(tenant, { ...inStore(scope), productId });
    for (const collectionId of distinctLinkIds(collectionIds)) {
      await this.links.insert(tenant, { id: this.ids.next(), ...inStore(scope), productId, collectionId });
    }
  }

  async collectionIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly CoreId[]> {
    const rows = await this.links.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), productId },
      order: { id: 'ASC' },
    });
    return rows.map((row) => toCoreId(row.collectionId));
  }

  async productIdsInCollection(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: CoreId,
  ): Promise<readonly CoreId[]> {
    const rows = await this.links.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), collectionId },
      order: { id: 'ASC' },
    });
    return rows.map((row) => toCoreId(row.productId));
  }

  async deleteProductLinks(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<void> {
    await this.links.delete(requestScope(ctx, scope), { ...inStore(scope), productId });
  }
}
