import type { CoreId } from '../../domain/core-id';
import { distinctLinkIds } from '../../domain/link-ids';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { ProductCollectionRepositoryPort } from '../../domain/ports/product-collection-repository.port';
import type { StoreScope } from '../../domain/store-scope';
import { inStore, type StoreRow } from './store-rows';

interface CollectionLink extends StoreRow {
  readonly productId: CoreId;
  readonly collectionId: CoreId;
}

/** A store's product-to-collection links in memory; it passes the collection link contract. */
export class InMemoryProductCollectionRepository implements ProductCollectionRepositoryPort {
  readonly links: CollectionLink[] = [];

  private removeLinks(scope: StoreScope, productId: CoreId): void {
    const kept = this.links.filter((link) => !(inStore(scope, link) && link.productId === productId));
    this.links.splice(0, this.links.length, ...kept);
  }

  replaceProductCollections(
    _ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    collectionIds: readonly CoreId[],
  ): Promise<void> {
    this.removeLinks(scope, productId);
    const { businessId, storeId } = scope;
    const added = distinctLinkIds(collectionIds).map((collectionId) => ({
      businessId,
      storeId,
      productId,
      collectionId,
    }));
    this.links.push(...added);
    return Promise.resolve();
  }

  collectionIdsOf(_ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly CoreId[]> {
    const own = this.links.filter((link) => inStore(scope, link) && link.productId === productId);
    return Promise.resolve(own.map((link) => link.collectionId));
  }

  productIdsInCollection(_ctx: OperationContext, scope: StoreScope, collectionId: CoreId): Promise<readonly CoreId[]> {
    const own = this.links.filter((link) => inStore(scope, link) && link.collectionId === collectionId);
    return Promise.resolve(own.map((link) => link.productId));
  }

  deleteProductLinks(_ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<void> {
    this.removeLinks(scope, productId);
    return Promise.resolve();
  }
}
