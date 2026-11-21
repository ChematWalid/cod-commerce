import { writableCollectionId } from '../domain/core-id';
import { CollectionNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';

/**
 * "Delete a collection" of the caller's active store: under the store lock (D2334) it removes our definition, its
 * members (FK cascade, D2337) and the Vendure collection when it is still in the store channel, and publishes `collection.changed` (D2335).
 */
export class DeleteCollectionService {
  constructor(private readonly ports: CollectionPorts) {}

  async delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    const collectionId = writableCollectionId(rawId);
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      if (!(await this.ports.definitions.delete(tx, scope, collectionId))) throw new CollectionNotFoundError();
      // A Vendure collection that already left the store channel must not keep its definition alive (and counted).
      if ((await this.ports.vendure.findMany(tx, [collectionId])).has(collectionId)) {
        await this.ports.vendure.delete(tx, collectionId);
      }
      await this.ports.events.publish(tx, scope, collectionId, 'deleted');
    });
  }
}
