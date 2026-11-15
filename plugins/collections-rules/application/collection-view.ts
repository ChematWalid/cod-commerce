import type { CollectionMode, CollectionRule } from '@cod/shared';
import type { CollectionDefinition } from '../domain/collection';
import { CollectionNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { CollectionMeta } from '../domain/ports/vendure-collections.port';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';

/** A store collection as the admin API shows it: Vendure's texts and image with our definition and member count. */
export interface StoreCollectionView extends CollectionMeta {
  /** The Vendure collection id. */
  readonly id: string;
  readonly mode: CollectionMode;
  readonly rule: CollectionRule | null;
  readonly visible: boolean;
  readonly position: number;
  readonly productCount: number;
}

/** A page of the admin list and how many collections match in all. */
export interface StoreCollectionPage {
  readonly items: readonly StoreCollectionView[];
  readonly totalItems: number;
}

const joined = (definition: CollectionDefinition, meta: CollectionMeta, productCount: number): StoreCollectionView => ({
  ...meta,
  id: definition.collectionId,
  mode: definition.mode,
  rule: definition.rule,
  visible: definition.visible,
  position: definition.position,
  productCount,
});

/**
 * The views of `definitions` in their order, with two batched reads (texts, counts). A definition whose Vendure
 * collection is not in the store channel is left out: it names nothing the store can show.
 */
export async function viewsOf(
  ports: Pick<CollectionPorts, 'vendure' | 'members'>,
  ctx: OperationContext,
  scope: StoreScope,
  definitions: readonly CollectionDefinition[],
): Promise<StoreCollectionView[]> {
  const ids = definitions.map((definition) => definition.collectionId);
  if (ids.length === 0) return [];
  const [metas, counts] = await Promise.all([
    ports.vendure.findMany(ctx, ids),
    ports.members.countsOf(ctx, scope, ids),
  ]);
  return definitions.flatMap((definition) => {
    const meta = metas.get(definition.collectionId);
    return meta === undefined ? [] : [joined(definition, meta, counts.get(definition.collectionId) ?? 0)];
  });
}

/** The view of one definition. @throws {CollectionNotFoundError} when its Vendure collection is not the store's. */
export async function viewOf(
  ports: Pick<CollectionPorts, 'vendure' | 'members'>,
  ctx: OperationContext,
  scope: StoreScope,
  definition: CollectionDefinition,
): Promise<StoreCollectionView> {
  const [view] = await viewsOf(ports, ctx, scope, [definition]);
  if (view === undefined) throw new CollectionNotFoundError();
  return view;
}
