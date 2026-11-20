import { writableCollectionId } from '../domain/core-id';
import { CollectionNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductSummary } from '../domain/ports/product-facts.port';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';

/** One page of a collection's products (`StoreCollectionProductList`) and how many it holds in all. */
export interface StoreCollectionProductPage {
  readonly items: readonly ProductSummary[];
  readonly totalItems: number;
}

/** Which page to read. */
export interface ProductPageRequest {
  readonly skip: number;
  readonly take: number;
}

/**
 * "The products of a collection" of the caller's active store, in collection order (D2318): hand order for a manual
 * one, newest first for an automatic one. Every member is listed, drafts and hidden products included (D2306).
 */
export class CollectionProductsService {
  constructor(private readonly ports: CollectionPorts) {}

  /** @throws {CollectionNotFoundError} when the store has no such collection. */
  async list(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    page: ProductPageRequest,
  ): Promise<StoreCollectionProductPage> {
    const collectionId = writableCollectionId(rawId);
    const definition = await this.ports.definitions.findByCollectionId(ctx, scope, collectionId);
    if (definition === undefined) throw new CollectionNotFoundError();
    const members = await this.ports.members.membersPage(ctx, scope, collectionId, page);
    const totalItems = (await this.ports.members.countsOf(ctx, scope, [collectionId])).get(collectionId) ?? 0;
    const pageIds = members.map((member) => member.productId);
    const summaries = await this.ports.facts.summariesOf(ctx, scope, pageIds);
    // `totalItems` counts member rows. A deleted product's rows go with it under the store lock (D2306), so a row
    // whose product the reader no longer returns only exists while that delete races this read: it is left out.
    const items = pageIds.flatMap((productId) => {
      const summary = summaries.get(productId);
      return summary === undefined ? [] : [summary];
    });
    return { items, totalItems };
  }
}
