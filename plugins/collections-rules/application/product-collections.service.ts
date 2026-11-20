import type { SetStoreProductCollectionsCommand } from '@cod/shared';
import { writableCollectionId } from '../domain/core-id';
import { CollectionNotFoundError, CollectionNotManualError, CollectionProductNotFoundError } from '../domain/errors';
import { canonicalProductId } from '../domain/membership';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { type CollectionRefView, ProductLinksService } from './product-links.service';

/** A collection named on the product side: its id and title. */
export interface StoreCollectionRef {
  readonly id: string;
  readonly title: string;
}

/** The collections of one product (`StoreProductCollections`): picked by hand, and added by a rule (read-only). */
export interface StoreProductCollectionsView {
  readonly manual: readonly StoreCollectionRef[];
  readonly automatic: readonly StoreCollectionRef[];
}

const refOf = ({ id, title }: CollectionRefView): StoreCollectionRef => ({ id, title });

/**
 * The product editor's collections block (D2324): reads a product's manual and automatic collections and replaces
 * its manual ones, under the store lock (D2334), appending it last to each collection it joins (D2318).
 */
export class ProductCollectionsService {
  private readonly links: ProductLinksService;

  constructor(private readonly ports: CollectionPorts) {
    this.links = new ProductLinksService(ports);
  }

  /** @throws {CollectionProductNotFoundError} when the product is not one of the store. */
  async of(ctx: OperationContext, scope: StoreScope, rawProductId: string): Promise<StoreProductCollectionsView> {
    const productId = canonicalProductId(rawProductId);
    await this.requireProduct(ctx, scope, productId);
    return this.viewOf(ctx, scope, productId);
  }

  /**
   * @throws {CollectionProductNotFoundError} when the product is not one of the store.
   * @throws {CollectionNotFoundError} when a collection is not one of the store (foreign, other store, malformed).
   * @throws {CollectionNotManualError} when a collection gets its products from its rule.
   * @throws {TooManyManualProductsError} when a collection the product joins is full.
   */
  async set(
    ctx: OperationContext,
    scope: StoreScope,
    command: SetStoreProductCollectionsCommand,
  ): Promise<StoreProductCollectionsView> {
    const productId = canonicalProductId(command.productId);
    const collectionIds = command.collectionIds.map(writableCollectionId);
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      await this.requireProduct(tx, scope, productId);
      await this.requireManual(tx, scope, collectionIds);
      await this.links.writeManual(tx, scope, productId, collectionIds);
      return this.viewOf(tx, scope, productId);
    });
  }

  private async requireProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    const found = await this.ports.facts.summariesOf(ctx, scope, [productId]);
    if (!found.has(productId)) throw new CollectionProductNotFoundError();
  }

  private async requireManual(ctx: OperationContext, scope: StoreScope, collectionIds: readonly string[]) {
    const definitions = await this.links.definitionsAmong(ctx, scope, collectionIds);
    if (definitions.length !== new Set(collectionIds).size) throw new CollectionNotFoundError();
    if (definitions.some((definition) => definition.mode !== 'manual')) throw new CollectionNotManualError();
  }

  private async viewOf(
    ctx: OperationContext,
    scope: StoreScope,
    productId: string,
  ): Promise<StoreProductCollectionsView> {
    const refs = await this.links.collectionsOf(ctx, scope, productId);
    return {
      manual: refs.filter((ref) => ref.manual).map(refOf),
      automatic: refs.filter((ref) => !ref.manual).map(refOf),
    };
  }
}
