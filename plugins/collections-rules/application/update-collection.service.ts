import type { UpdateStoreCollectionCommand } from '@cod/shared';
import { type CollectionDefinition, switchMode } from '../domain/collection';
import { writableCollectionId } from '../domain/core-id';
import { CollectionNotFoundError, InvalidCollectionRuleError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { CollectionMeta, CollectionTexts, VendureCollectionPatch } from '../domain/ports/vendure-collections.port';
import type { StoreScope } from '../domain/store-scope';
import { checkedImageId, cleanDescription, refuseTakenSlug } from './collection-checks';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionView, viewOf } from './collection-view';

/** What an update reads before it writes: the store's definition and its Vendure texts. */
interface Current {
  readonly definition: CollectionDefinition;
  readonly meta: CollectionMeta;
}

const TEXT_FIELDS = ['title', 'slug', 'description'] as const;

/**
 * "Edit a collection" of the caller's active store: any field, an absent one unchanged (D2300). Runs under the store
 * lock (D2334), since a mode switch rewrites the members, and publishes `collection.changed` (D2335).
 */
export class UpdateCollectionService {
  constructor(private readonly ports: CollectionPorts) {}

  async update(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    command: UpdateStoreCollectionCommand,
  ): Promise<StoreCollectionView> {
    const collectionId = writableCollectionId(rawId);
    // Rule saves recompute membership (D2312); until that lands no collection takes a rule.
    if (command.mode === 'automatic' || command.rule !== undefined) throw new InvalidCollectionRuleError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const current = await this.currentOf(tx, scope, collectionId);
      const patch = await this.patchOf(tx, current, command);
      // A position or mode edit leaves Vendure's collection as it is: no write, no Vendure `updated` event.
      if (Object.keys(patch).length > 0) await this.ports.vendure.update(tx, collectionId, patch);
      const definition = await this.switchedMode(tx, scope, current.definition, command);
      const saved = {
        ...definition,
        visible: command.visible ?? definition.visible,
        position: command.position ?? definition.position,
      };
      await this.ports.definitions.update(tx, scope, saved);
      await this.ports.events.publish(tx, scope, collectionId, 'updated');
      return viewOf(this.ports, tx, scope, saved);
    });
  }

  private async currentOf(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<Current> {
    const definition = await this.ports.definitions.findByCollectionId(ctx, scope, collectionId);
    if (definition === undefined) throw new CollectionNotFoundError();
    const meta = (await this.ports.vendure.findMany(ctx, [collectionId])).get(collectionId);
    if (meta === undefined) throw new CollectionNotFoundError();
    return { definition, meta };
  }

  private async patchOf(
    ctx: OperationContext,
    { definition, meta }: Current,
    command: UpdateStoreCollectionCommand,
  ): Promise<VendureCollectionPatch> {
    const texts = this.textsOf(meta, command);
    if (command.slug !== undefined) await refuseTakenSlug(this.ports, ctx, command.slug, definition.collectionId);
    const image =
      command.featuredAssetId === undefined
        ? {}
        : { featuredAssetId: await checkedImageId(this.ports, ctx, command.featuredAssetId) };
    return {
      ...(texts === undefined ? {} : { texts }),
      ...image,
      ...(command.visible === undefined ? {} : { isPrivate: !command.visible }),
    };
  }

  /** The texts after the patch, or `undefined` when the command names none; the slug stays unless one is given. */
  private textsOf(meta: CollectionMeta, command: UpdateStoreCollectionCommand): CollectionTexts | undefined {
    if (!TEXT_FIELDS.some((field) => command[field] !== undefined)) return undefined;
    return {
      title: command.title ?? meta.title,
      slug: command.slug ?? meta.slug,
      description:
        command.description === undefined ? meta.description : cleanDescription(this.ports, command.description),
    };
  }

  /** The definition after a mode switch (D2302): automatic → manual keeps the members in order as the manual list. */
  private async switchedMode(
    ctx: OperationContext,
    scope: StoreScope,
    definition: CollectionDefinition,
    command: UpdateStoreCollectionCommand,
  ): Promise<CollectionDefinition> {
    if (command.mode === undefined || command.mode === definition.mode) return definition;
    const members = await this.ports.members.membersOf(ctx, scope, definition.collectionId);
    const switched = switchMode(definition, command.mode, null, members);
    if (switched.members !== 'recompute') {
      await this.ports.members.replaceMembers(ctx, scope, definition.collectionId, switched.members);
    }
    return switched.definition;
  }
}
