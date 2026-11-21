import { COLLECTIONS_PER_STORE_MAX, normalForMatch, type StoreCollectionListQuery } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionPage, viewsOf } from './collection-view';

/**
 * "List collections" of the caller's active store by position, then id (D2318, D2325). A search keeps the collections
 * whose title contains it whatever its case or Arabic written form (D2305). Titles live in Vendure, so every list reads
 * the store's collections once (at most {@link COLLECTIONS_PER_STORE_MAX}) and pages only the definitions whose Vendure
 * collection is still in the store channel: the page and its total then agree on every page. A search with no letter
 * left once normalised (only tatweel or harakat) names nothing, so it finds nothing.
 */
export class ListCollectionsService {
  constructor(private readonly ports: CollectionPorts) {}

  async list(ctx: OperationContext, scope: StoreScope, query: StoreCollectionListQuery): Promise<StoreCollectionPage> {
    const collectionIds = await this.shown(ctx, scope, 'search' in query ? query.search : undefined);
    const page = await this.ports.definitions.list(ctx, scope, { skip: query.skip, take: query.take, collectionIds });
    const items = await viewsOf(this.ports, ctx, scope, page.items);
    return { items, totalItems: page.totalItems };
  }

  private async shown(ctx: OperationContext, scope: StoreScope, search: string | undefined): Promise<string[]> {
    const needle = search === undefined ? undefined : normalForMatch(search);
    if (needle === '') return [];
    const all = await this.ports.definitions.list(ctx, scope, { skip: 0, take: COLLECTIONS_PER_STORE_MAX });
    const metas = await this.ports.vendure.findMany(
      ctx,
      all.items.map((definition) => definition.collectionId),
    );
    const matches = [...metas].filter(
      ([, meta]) => needle === undefined || normalForMatch(meta.title).includes(needle),
    );
    return matches.map(([id]) => id);
  }
}
