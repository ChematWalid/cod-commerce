import { CreateCollectionService } from '../../application/create-collection.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import type { FakeCollectionWorld } from '../fakes/collection-ports';
import { priceRule } from './builders';

const ctx = asOperationContext({});
let made = 0;

/** A manual collection of `scope` made through the create use case; returns its collection id. */
export async function manualCollection(world: FakeCollectionWorld, scope: StoreScope, title?: string): Promise<string> {
  made += 1;
  const view = await new CreateCollectionService(world.ports).create(ctx, scope, {
    title: title ?? `Collection ${String(made)}`,
    slug: `collection-${String(made)}`,
    visible: true,
    position: made,
    mode: 'manual',
    rule: undefined,
  });
  return view.id;
}

/**
 * An automatic collection of `scope` holding `memberIds` (made manual, then switched in the table, since rule saves
 * land in Task 7); returns its collection id.
 */
export async function automaticCollection(
  world: FakeCollectionWorld,
  scope: StoreScope,
  memberIds: readonly string[] = [],
): Promise<string> {
  const collectionId = await manualCollection(world, scope);
  const { definitions, members } = world.tables;
  const definition = await definitions.findByCollectionId(ctx, scope, collectionId);
  if (definition === undefined) throw new Error('the collection was just made');
  await definitions.update(ctx, scope, { ...definition, mode: 'automatic', rule: priceRule(1, 2) });
  const rows = memberIds.map((productId) => ({ productId, position: 0 }));
  await members.replaceMembers(ctx, scope, collectionId, rows);
  return collectionId;
}
