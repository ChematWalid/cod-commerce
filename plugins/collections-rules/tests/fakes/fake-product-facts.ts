import type { ProductFacts } from '../../domain/product-facts';
import type {
  ProductFactsPort,
  ProductIdPage,
  ProductSummary,
  RuleOptions,
} from '../../domain/ports/product-facts.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { canonicalCoreIds } from '../../domain/core-id';

const NO_OPTIONS: RuleOptions = { brands: [], tags: [], options: [] };

/**
 * {@link ProductFactsPort} for use-case tests: each store's products as list summaries. A product of another store is
 * absent, like the catalog reader's answer; rule facts are not kept (the rule tests use the domain directly).
 */
export class FakeProductFacts implements ProductFactsPort {
  private readonly byStore = new Map<string, Map<string, ProductSummary>>();

  /** Puts products in `scope`'s store, each `Product <id>` at 1 000 DZD, active. */
  add(scope: StoreScope, ...productIds: string[]): void {
    const store = this.byStore.get(scope.storeId) ?? new Map<string, ProductSummary>();
    for (const productId of productIds) {
      store.set(productId, { productId, title: `Product ${productId}`, status: 'active', price: 1_000 });
    }
    this.byStore.set(scope.storeId, store);
  }

  /** Removes a product from its store, as a delete does. */
  remove(scope: StoreScope, productId: string): void {
    this.byStore.get(scope.storeId)?.delete(productId);
  }

  summariesOf(
    _ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProductSummary>> {
    const store = this.byStore.get(scope.storeId) ?? new Map<string, ProductSummary>();
    const found = canonicalCoreIds(productIds).flatMap((id) => {
      const summary = store.get(id);
      return summary === undefined ? [] : [[id, summary] as const];
    });
    return Promise.resolve(new Map(found));
  }

  factsOf(): Promise<readonly ProductFacts[]> {
    return Promise.resolve([]);
  }

  pageIds(): Promise<ProductIdPage> {
    return Promise.resolve({ ids: [], next: null });
  }

  ruleOptionsOf(): Promise<RuleOptions> {
    return Promise.resolve(NO_OPTIONS);
  }
}
