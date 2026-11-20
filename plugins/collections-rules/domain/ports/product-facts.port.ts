import type { ProductFacts } from '../product-facts';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** One keyset page of a store's product ids, newest first: the next page starts below `after` (D2308). */
export interface ProductIdPageRequest {
  readonly after: string | null;
  readonly take: number;
  readonly search?: string;
}

/** The ids of one page and the `after` of the next one, `null` after the last page. */
export interface ProductIdPage {
  readonly ids: readonly string[];
  readonly next: string | null;
}

/** A brand or tag of the store, for the condition builder. */
export interface RuleOptionName {
  readonly id: string;
  readonly name: string;
}

/** An option name of the store with its values (AC3). */
export interface RuleOptionValues {
  readonly name: string;
  readonly values: readonly string[];
}

/** What the condition builder offers: the store's brands, tags and option names with their values. */
export interface RuleOptions {
  readonly brands: readonly RuleOptionName[];
  readonly tags: readonly RuleOptionName[];
  readonly options: readonly RuleOptionValues[];
}

/** What a collection's product list shows of a product (`StoreCollectionProduct`). */
export interface ProductSummary {
  readonly productId: string;
  readonly title: string;
  /** The catalog status (`active`, `draft`, `hidden`), shown as it is. */
  readonly status: string;
  /** The lowest price among the non-hidden variants (D2304), whole DZD. */
  readonly price: number;
}

/**
 * The rule facts of a store's products (D2304, D2308). `ctx` must be on the store's channel. Every method reads only
 * the scope's store: an id of another store is simply absent.
 */
export interface ProductFactsPort {
  /** The facts of the given products that exist in the store, newest first, whatever the number of ids. */
  factsOf(ctx: OperationContext, scope: StoreScope, productIds: readonly string[]): Promise<readonly ProductFacts[]>;
  /**
   * The list summaries of the given products that exist in the store, keyed by canonical id; a product of another
   * store, a deleted one or a malformed id is absent. Also how a use case checks that a product is the store's.
   */
  summariesOf(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProductSummary>>;
  /** One keyset page of the store's product ids, newest first. */
  pageIds(ctx: OperationContext, scope: StoreScope, page: ProductIdPageRequest): Promise<ProductIdPage>;
  /** The brands, tags and option names with values the store's products use. */
  ruleOptionsOf(ctx: OperationContext, scope: StoreScope): Promise<RuleOptions>;
}
