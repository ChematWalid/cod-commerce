import type { SetStoreCollectionProductsCommand } from '@cod/shared';
import { writableCollectionId } from '../domain/core-id';
import { CollectionNotFoundError, CollectionNotManualError, CollectionProductNotFoundError } from '../domain/errors';
import { manualMembers } from '../domain/membership';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionView, viewOf } from './collection-view';

/**
 * "Set the products of a manual collection" of the caller's active store (D2318): the list replaces the stored one,
 * in its order, under the store lock (D2334), and publishes `collection.changed` (`membership`, D2335).
 */
export class SetCollectionProductsService {
  constructor(private readonly ports: CollectionPorts) {}

  /**
   * @throws {CollectionNotFoundError} when the store has no such collection.
   * @throws {CollectionNotManualError} when it gets its products from its rule.
   * @throws {CollectionProductNotFoundError} when a product is not one of the store; nothing is written.
   * @throws {TooManyManualProductsError} above the manual cap.
   */
  async set(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    command: SetStoreCollectionProductsCommand,
  ): Promise<StoreCollectionView> {
    const collectionId = writableCollectionId(rawId);
    const members = manualMembers(command.productIds);
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const definition = await this.ports.definitions.findByCollectionId(tx, scope, collectionId);
      if (definition === undefined) throw new CollectionNotFoundError();
      if (definition.mode !== 'manual') throw new CollectionNotManualError();
      const productIds = members.map((member) => member.productId);
      const found = await this.ports.facts.summariesOf(tx, scope, productIds);
      if (productIds.some((productId) => !found.has(productId))) throw new CollectionProductNotFoundError();
      await this.ports.members.replaceMembers(tx, scope, collectionId, members);
      await this.ports.events.publish(tx, scope, collectionId, 'membership');
      return viewOf(this.ports, tx, scope, definition);
    });
  }
}
