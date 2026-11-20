import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPageRequest, StoreCollectionProductPage } from './collection-products.service';
import type { CollectionPorts } from './collection-ports';
import { summariesInOrder } from './preview-matches.service';
import { storeProductIds } from './store-walk';

/** A product search page: an optional title text and the page to show. */
export interface ProductSearchRequest extends ProductPageRequest {
  readonly search?: string;
}

/**
 * "Find a product to add" for the manual collection editor (D2321): the active store's products whose title holds
 * the text, newest first, with their count. Our own operation, so a collections-only member can pick products.
 */
export class ProductSearchService {
  constructor(private readonly ports: CollectionPorts) {}

  async run(
    ctx: OperationContext,
    scope: StoreScope,
    request: ProductSearchRequest,
  ): Promise<StoreCollectionProductPage> {
    const ids = await storeProductIds(this.ports.facts, ctx, scope, request.search);
    const pageIds = ids.slice(request.skip, request.skip + request.take);
    return { totalItems: ids.length, items: await summariesInOrder(this.ports.facts, ctx, scope, pageIds) };
  }
}
