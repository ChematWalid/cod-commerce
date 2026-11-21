import {
  type CollectionRule,
  COLLECTIONS_PER_STORE_MAX,
  type CreateStoreCollectionCommand,
  NORMAL_FORM_VERSION,
} from '@cod/shared';
import type { CollectionDefinition } from '../domain/collection';
import { InvalidCollectionRuleError, TooManyCollectionsError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { checkedImageId, cleanDescription, refuseTakenSlug } from './collection-checks';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionView, viewOf } from './collection-view';
import { RecomputeMembershipService } from './recompute-membership.service';
import type { SaveTimeRecompute } from './save-recompute.service';

/** The rule an automatic collection is created with; a manual one takes none (the input schema refused one, D2302). */
function ruleOf(command: CreateStoreCollectionCommand): CollectionRule | null {
  if (command.mode === 'manual') return null;
  if (command.rule === undefined) throw new InvalidCollectionRuleError();
  return command.rule;
}

/**
 * "Create a collection" in the caller's active store (D2300): the Vendure collection in the store channel only
 * (D2333) and our definition, written with `collection.changed` (D2335) in one transaction under the store lock
 * (D2334), so the per-store cap (D2322) holds against a parallel create. An automatic collection gets its rule's
 * matches as members in the same transaction (D2312).
 */
export class CreateCollectionService {
  constructor(
    private readonly ports: CollectionPorts,
    private readonly recompute: SaveTimeRecompute = new RecomputeMembershipService(ports),
  ) {}

  async create(
    ctx: OperationContext,
    scope: StoreScope,
    command: CreateStoreCollectionCommand,
  ): Promise<StoreCollectionView> {
    const rule = ruleOf(command);
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
      const definition = this.definitionOf(scope, collectionId, command, rule);
      await this.ports.definitions.insert(tx, scope, definition);
      await this.ports.events.publish(tx, scope, collectionId, 'created');
      const built = await this.recompute.forStore(tx, scope, definition);
      return viewOf(this.ports, tx, scope, built);
    });
  }

  private definitionOf(
    scope: StoreScope,
    collectionId: string,
    command: CreateStoreCollectionCommand,
    rule: CollectionRule | null,
  ): CollectionDefinition {
    return {
      id: this.ports.ids.next(),
      collectionId,
      storeId: scope.storeId,
      mode: command.mode,
      rule,
      matchVersion: NORMAL_FORM_VERSION,
      visible: command.visible,
      position: command.position,
    };
  }
}
