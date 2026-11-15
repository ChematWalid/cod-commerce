import { COLLECTIONS_PER_STORE_MAX, normalForMatch, type StoreCollectionListQuery } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { type StoreCollectionPage, viewsOf } from './collection-view';

/**
 * "List collections" of the caller's active store by position, then id (D2318, D2325). A search keeps the collections
 * whose title contains it whatever its case or Arabic written form (D2305); titles live in Vendure, so the search
 * reads the store's titles (at most {@link COLLECTIONS_PER_STORE_MAX}) and pages the matching definitions. A search
 * with no letter left once normalised (only tatweel or harakat) names nothing, so it finds nothing.
 */
export class ListCollectionsService {
  constructor(private readonly ports: CollectionPorts) {}

  async list(ctx: OperationContext, scope: StoreScope, query: StoreCollectionListQuery): Promise<StoreCollectionPage> {
    const collectionIds = 'search' in query ? await this.matching(ctx, scope, query.search) : undefined;
    const page = await this.ports.definitions.list(ctx, scope, {
      skip: query.skip,
      take: query.take,
      ...(collectionIds === undefined ? {} : { collectionIds }),
    });
    const items = await viewsOf(this.ports, ctx, scope, page.items);
    // A definition whose Vendure collection left the store channel is not shown, so it is not counted either.
    return { items, totalItems: page.totalItems - (page.items.length - items.length) };
  }

  private async matching(ctx: OperationContext, scope: StoreScope, search: string): Promise<string[]> {
    const needle = normalForMatch(search);
    if (needle === '') return [];
    const all = await this.ports.definitions.list(ctx, scope, { skip: 0, take: COLLECTIONS_PER_STORE_MAX });
    const metas = await this.ports.vendure.findMany(
      ctx,
      all.items.map((definition) => definition.collectionId),
    );
    return [...metas].filter(([, meta]) => normalForMatch(meta.title).includes(needle)).map(([id]) => id);
  }
}
