import { canonicalCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionView, viewsOf } from './collection-view';

/** "Open a collection" of the caller's active store; a foreign, other-store or malformed id finds nothing. */
export class GetCollectionService {
  constructor(private readonly ports: CollectionPorts) {}

  async find(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<StoreCollectionView | undefined> {
    const collectionId = canonicalCoreId(rawId);
    if (collectionId === undefined) return undefined;
    const definition = await this.ports.definitions.findByCollectionId(ctx, scope, collectionId);
    if (definition === undefined) return undefined;
    const [view] = await viewsOf(this.ports, ctx, scope, [definition]);
    return view;
  }
}
