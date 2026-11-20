import { type CollectionRule, NORMAL_FORM_VERSION, type UpdateStoreCollectionCommand } from '@cod/shared';
import { type CollectionDefinition, needsCurrentMembers, switchMode } from '../domain/collection';
import { writableCollectionId } from '../domain/core-id';
import { CollectionNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { CollectionMeta, CollectionTexts, VendureCollectionPatch } from '../domain/ports/vendure-collections.port';
import type { StoreScope } from '../domain/store-scope';
import { checkedImageId, cleanDescription, refuseTakenSlug } from './collection-checks';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionView, viewOf } from './collection-view';
import { RecomputeMembershipService } from './recompute-membership.service';

/** What an update reads before it writes: the store's definition and its Vendure texts. */
interface Current {
  readonly definition: CollectionDefinition;
  readonly meta: CollectionMeta;
}

/** The definition after a mode or rule save, and whether its members must be rebuilt from its rule (D2312). */
interface SavedMode {
  readonly definition: CollectionDefinition;
  readonly recompute: boolean;
}

const TEXT_FIELDS = ['title', 'slug', 'description'] as const;

/**
 * The rule a save leaves: the one sent, else the stored one for an automatic collection; a manual collection keeps
 * none, so a rule sent for it is refused by `switchMode`.
 */
function ruleAfter(
  definition: CollectionDefinition,
  mode: CollectionDefinition['mode'],
  command: UpdateStoreCollectionCommand,
): CollectionRule | null {
  if (command.rule !== undefined) return command.rule;
  return mode === 'automatic' ? definition.rule : null;
}

/**
 * "Edit a collection" of the caller's active store: any field, an absent one unchanged (D2300). Runs under the store
 * lock (D2334), since a mode or rule save rewrites the members (D2302, D2312), and publishes `collection.changed`
 * (D2335): `updated`, then `membership` when the rule's matches were rebuilt.
 */
export class UpdateCollectionService {
  constructor(
    private readonly ports: CollectionPorts,
    private readonly recompute = new RecomputeMembershipService(ports),
  ) {}

  async update(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    command: UpdateStoreCollectionCommand,
  ): Promise<StoreCollectionView> {
    const collectionId = writableCollectionId(rawId);
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const current = await this.currentOf(tx, scope, collectionId);
      const patch = await this.patchOf(tx, current, command);
      // A position or mode edit leaves Vendure's collection as it is: no write, no Vendure `updated` event.
      if (Object.keys(patch).length > 0) await this.ports.vendure.update(tx, collectionId, patch);
      const { definition, recompute } = await this.switchedMode(tx, scope, current.definition, command);
      const saved = {
        ...definition,
        visible: command.visible ?? definition.visible,
        position: command.position ?? definition.position,
        ...(recompute ? { matchVersion: NORMAL_FORM_VERSION } : {}),
      };
      await this.ports.definitions.update(tx, scope, saved);
      await this.ports.events.publish(tx, scope, collectionId, 'updated');
      if (recompute) await this.recompute.forStore(tx, scope, saved);
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

  /**
   * The definition after a save of its mode or rule (D2302): automatic → manual keeps the members in order as the
   * manual list, a switch to automatic or a new rule asks for a recompute, the same rule or manual → manual keeps the
   * members without reading or rewriting a row, so a resent mode does not hold the store lock over every member.
   */
  private async switchedMode(
    ctx: OperationContext,
    scope: StoreScope,
    definition: CollectionDefinition,
    command: UpdateStoreCollectionCommand,
  ): Promise<SavedMode> {
    if (command.mode === undefined && command.rule === undefined) return { definition, recompute: false };
    const mode = command.mode ?? definition.mode;
    const members = needsCurrentMembers(definition, mode)
      ? await this.ports.members.membersOf(ctx, scope, definition.collectionId)
      : [];
    const switched = switchMode(definition, mode, ruleAfter(definition, mode, command), members);
    if (switched.members === 'recompute') return { definition: switched.definition, recompute: true };
    if (switched.members !== 'keep') {
      await this.ports.members.replaceMembers(ctx, scope, definition.collectionId, switched.members);
    }
    return { definition: switched.definition, recompute: false };
  }
}
