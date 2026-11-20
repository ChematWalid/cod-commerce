import type { CollectionRule } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductFactsPort, ProductSummary } from '../domain/ports/product-facts.port';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPageRequest, StoreCollectionProductPage } from './collection-products.service';
import type { CollectionPorts } from './collection-ports';
import { storeMatches } from './store-walk';

/** The summaries of `pageIds` in their order; a product deleted since its id was read is left out. */
export async function summariesInOrder(
  facts: ProductFactsPort,
  ctx: OperationContext,
  scope: StoreScope,
  pageIds: readonly string[],
): Promise<ProductSummary[]> {
  const summaries = await facts.summariesOf(ctx, scope, pageIds);
  return pageIds.flatMap((productId) => {
    const summary = summaries.get(productId);
    return summary === undefined ? [] : [summary];
  });
}

/**
 * "Which products would this rule pick?" (D2331): the unsaved rule matched over every product of the active store,
 * newest first, with the count of all matches and one page of them. Reads only: no transaction, lock or write.
 */
export class PreviewMatchesService {
  constructor(private readonly ports: CollectionPorts) {}

  async run(
    ctx: OperationContext,
    scope: StoreScope,
    rule: CollectionRule,
    page: ProductPageRequest,
  ): Promise<StoreCollectionProductPage> {
    const matched = await storeMatches(this.ports.facts, ctx, scope, rule);
    const pageIds = matched.slice(page.skip, page.skip + page.take);
    return { totalItems: matched.length, items: await summariesInOrder(this.ports.facts, ctx, scope, pageIds) };
  }
}
