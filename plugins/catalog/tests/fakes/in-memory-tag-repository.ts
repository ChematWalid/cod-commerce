import type { Snowflake } from '@cod/shared';
import type { CoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { TagRepositoryPort } from '../../domain/ports/tag-repository.port';
import type { StoreScope } from '../../domain/store-scope';
import { InMemoryCatalogNameRepository } from './in-memory-catalog-name-repository';
import { inStore, type StoreRow } from './store-rows';

interface TagLink extends StoreRow {
  readonly productId: CoreId;
  readonly tagId: Snowflake;
}

/** A store's tags and product links in memory; it passes the tag contract. */
export class InMemoryTagRepository extends InMemoryCatalogNameRepository implements TagRepositoryPort {
  readonly links: TagLink[] = [];

  private removeLinks(keep: (link: TagLink) => boolean): void {
    const kept = this.links.filter(keep);
    this.links.splice(0, this.links.length, ...kept);
  }

  override async delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const deleted = await super.delete(ctx, scope, id);
    if (deleted) this.removeLinks((link) => !(inStore(scope, link) && link.tagId === id));
    return deleted;
  }

  replaceProductTags(
    _ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    tagIds: readonly Snowflake[],
  ): Promise<void> {
    this.removeLinks((link) => !(inStore(scope, link) && link.productId === productId));
    const { businessId, storeId } = scope;
    this.links.push(...tagIds.map((tagId) => ({ businessId, storeId, productId, tagId })));
    return Promise.resolve();
  }

  tagIdsOf(_ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly Snowflake[]> {
    const own = this.links.filter((link) => inStore(scope, link) && link.productId === productId);
    return Promise.resolve(own.map((link) => link.tagId));
  }

  productIdsWithTag(_ctx: OperationContext, scope: StoreScope, tagId: Snowflake): Promise<readonly CoreId[]> {
    const own = this.links.filter((link) => inStore(scope, link) && link.tagId === tagId);
    return Promise.resolve(own.map((link) => link.productId));
  }
}
