import { COLLECTIONS_PER_STORE_MAX, type CreateStoreCollectionCommand, NORMAL_FORM_VERSION } from '@cod/shared';
import type { CollectionDefinition } from '../domain/collection';
import { InvalidCollectionRuleError, TooManyCollectionsError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { checkedImageId, cleanDescription, refuseTakenSlug } from './collection-checks';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionView, viewOf } from './collection-view';

/**
 * "Create a collection" in the caller's active store (D2300): the Vendure collection in the store channel only
 * (D2333) and our definition, written with `collection.changed` (D2335) in one transaction under the store lock
 * (D2334), so the per-store cap (D2322) holds against a parallel create.
 */
export class CreateCollectionService {
  constructor(private readonly ports: CollectionPorts) {}

  async create(
    ctx: OperationContext,
    scope: StoreScope,
    command: CreateStoreCollectionCommand,
  ): Promise<StoreCollectionView> {
    // Rule saves recompute membership (D2312); until that lands an automatic collection cannot be created.
    if (command.mode === 'automatic') throw new InvalidCollectionRuleError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      if ((await this.ports.definitions.countInStore(tx, scope)) >= COLLECTIONS_PER_STORE_MAX) {
        throw new TooManyCollectionsError();
      }
      const slug = command.slug ?? command.title;
      await refuseTakenSlug(this.ports, tx, slug);
      const featuredAssetId = await checkedImageId(this.ports, tx, command.featuredAssetId);
      const description = cleanDescription(this.ports, command.description);
      const collectionId = await this.ports.vendure.create(tx, {
        title: command.title,
        slug,
        description,
        featuredAssetId,
        isPrivate: !command.visible,
      });
      const definition = this.definitionOf(scope, collectionId, command);
      await this.ports.definitions.insert(tx, scope, definition);
      await this.ports.events.publish(tx, scope, collectionId, 'created');
      return viewOf(this.ports, tx, scope, definition);
    });
  }

  private definitionOf(
    scope: StoreScope,
    collectionId: string,
    command: CreateStoreCollectionCommand,
  ): CollectionDefinition {
    return {
      id: this.ports.ids.next(),
      collectionId,
      storeId: scope.storeId,
      mode: 'manual',
      rule: null,
      matchVersion: NORMAL_FORM_VERSION,
      visible: command.visible,
      position: command.position,
    };
  }
}
