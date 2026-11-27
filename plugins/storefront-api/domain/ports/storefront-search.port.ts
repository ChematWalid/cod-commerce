import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';
import type { ProjectionPage } from './projection-repository.port';

/** Which page of the results a search answers. */
export interface SearchPageRequest {
  readonly skip: number;
  readonly take: number;
}

/** The trigram search over a store's `storefront_product` rows (ADR 0014 Phase 1). */
export interface StorefrontSearchPort {
  /**
   * One page of the store's listed rows whose search text matches one of `variants` (word similarity), best first: rows
   * matching the first variant, the query itself, before rows only a synonym finds; then an exact word before a word
   * prefix before a plain trigram match; newest on a tie. Confined to the scope's business and store.
   */
  search(
    ctx: OperationContext,
    scope: StoreScope,
    variants: readonly string[],
    page: SearchPageRequest,
  ): Promise<ProjectionPage>;
}
