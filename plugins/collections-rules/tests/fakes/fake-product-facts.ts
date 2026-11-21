import type { ProductFacts } from '../../domain/product-facts';
import type {
  ProductFactsPort,
  ProductIdPage,
  ProductIdPageRequest,
  ProductSummary,
  RuleOptions,
} from '../../domain/ports/product-facts.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { canonicalCoreIds } from '../../domain/core-id';

const NO_OPTIONS: RuleOptions = { brands: [], tags: [], options: [] };
const DEFAULT_PRICE = 1_000;

/** One product of a fake store: what the list shows and what a rule reads. */
interface StoredProduct {
  readonly summary: ProductSummary;
  readonly facts: ProductFacts;
}

const byNewest = (left: string, right: string): number => {
  const [leftId, rightId] = [BigInt(left), BigInt(right)];
  if (leftId === rightId) return 0;
  return rightId > leftId ? 1 : -1;
};

/** Facts of a product with no tag, brand or option, at `price`, not on sale. */
const plainFacts = (productId: string, title: string, price: number): ProductFacts => ({
  productId,
  title,
  brandId: null,
  tagIds: [],
  price,
  onSale: false,
  variantOptions: [],
});

/**
 * {@link ProductFactsPort} for use-case tests: each store's products with their list summary and rule facts. A product
 * of another store is absent, like the catalog reader's answer; pages are keyset pages, newest first (D2308).
 */
export class FakeProductFacts implements ProductFactsPort {
  private readonly byStore = new Map<string, Map<string, StoredProduct>>();
  /** Every page asked for, in order, so a test can see how a walk paged. */
  readonly pageRequests: ProductIdPageRequest[] = [];
  /** The id lists `factsOf` was asked for, in order. */
  readonly factsRequests: (readonly string[])[] = [];
  ruleOptions: RuleOptions = NO_OPTIONS;

  private storeOf(scope: StoreScope): Map<string, StoredProduct> {
    const store = this.byStore.get(scope.storeId) ?? new Map<string, StoredProduct>();
    this.byStore.set(scope.storeId, store);
    return store;
  }

  /** Puts products in `scope`'s store, each `Product <id>` at 1 000 DZD, active, with no tag, brand or option. */
  add(scope: StoreScope, ...productIds: string[]): void {
    for (const productId of productIds) this.put(scope, plainFacts(productId, `Product ${productId}`, DEFAULT_PRICE));
  }

  /** Puts one product with its rule facts in `scope`'s store (active unless said otherwise). */
  put(scope: StoreScope, facts: ProductFacts, status = 'active'): void {
    const { productId, title, price } = facts;
    this.storeOf(scope).set(productId, { summary: { productId, title, status, price }, facts });
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
    const store = this.storeOf(scope);
    const found = canonicalCoreIds(productIds).flatMap((id) => {
      const stored = store.get(id);
      return stored === undefined ? [] : [[id, stored.summary] as const];
    });
    return Promise.resolve(new Map(found));
  }

  factsOf(_ctx: OperationContext, scope: StoreScope, productIds: readonly string[]): Promise<readonly ProductFacts[]> {
    this.factsRequests.push([...productIds]);
    const store = this.storeOf(scope);
    const found = canonicalCoreIds(productIds)
      .sort(byNewest)
      .flatMap((id) => {
        const stored = store.get(id);
        return stored === undefined ? [] : [stored.facts];
      });
    return Promise.resolve(found);
  }

  pageIds(_ctx: OperationContext, scope: StoreScope, page: ProductIdPageRequest): Promise<ProductIdPage> {
    this.pageRequests.push(page);
    const search = page.search?.toLowerCase();
    const ids = [...this.storeOf(scope).values()]
      .filter((stored) => search === undefined || stored.facts.title.toLowerCase().includes(search))
      .map((stored) => stored.facts.productId)
      .sort(byNewest)
      .filter((id) => page.after === null || BigInt(id) < BigInt(page.after));
    const taken = ids.slice(0, page.take);
    const last = taken.at(-1);
    return Promise.resolve({ ids: taken, next: ids.length > page.take && last !== undefined ? last : null });
  }

  ruleOptionsOf(): Promise<RuleOptions> {
    return Promise.resolve(this.ruleOptions);
  }
}
