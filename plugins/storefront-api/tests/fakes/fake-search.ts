import type { TenantScope } from '@cod/shared';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { ProjectionPage } from '../../domain/ports/projection-repository.port';
import type { SearchPageRequest, StorefrontSearchPort } from '../../domain/ports/storefront-search.port';
import type { SynonymRepositoryPort } from '../../domain/ports/synonym-repository.port';
import type { SynonymPair } from '../../domain/search-query';
import type { StoreScope } from '../../domain/store-scope';
import type { InMemoryProjectionRepository } from './in-memory-projection.repository';

/** One search the fake answered. */
export interface RecordedSearch {
  readonly scope: StoreScope;
  readonly variants: readonly string[];
  readonly page: SearchPageRequest;
}

/**
 * {@link StorefrontSearchPort} over the in-memory projection: a listed row matches when its search text contains a
 * variant (no trigram scoring), rows of the first variant first. Records every search.
 */
export class FakeStorefrontSearch implements StorefrontSearchPort {
  readonly searches: RecordedSearch[] = [];

  constructor(private readonly projection: InMemoryProjectionRepository) {}

  search(
    _ctx: OperationContext,
    scope: StoreScope,
    variants: readonly string[],
    page: SearchPageRequest,
  ): Promise<ProjectionPage> {
    this.searches.push({ scope, variants, page });
    const rankOf = (text: string): number => variants.findIndex((variant) => text.includes(variant));
    const matching = [...this.projection.rowsOf(scope).values()]
      .filter((row) => row.listed && rankOf(row.searchText) >= 0)
      .sort((a, b) => rankOf(a.searchText) - rankOf(b.searchText));
    return Promise.resolve({ items: matching.slice(page.skip, page.skip + page.take), totalItems: matching.length });
  }
}

/** {@link SynonymRepositoryPort} in memory, one list per business. */
export class InMemorySynonyms implements SynonymRepositoryPort {
  private readonly pairs = new Map<string, SynonymPair[]>();

  pairsOf(business: TenantScope): SynonymPair[] {
    const pairs = this.pairs.get(business.businessId) ?? [];
    this.pairs.set(business.businessId, pairs);
    return pairs;
  }

  seedIfEmpty(_ctx: OperationContext, business: TenantScope, pairs: readonly SynonymPair[]): Promise<void> {
    const own = this.pairsOf(business);
    if (own.length === 0) own.push(...pairs);
    return Promise.resolve();
  }

  matching(_ctx: OperationContext, business: TenantScope, words: readonly string[]): Promise<readonly SynonymPair[]> {
    const wanted = new Set(words);
    const own = this.pairsOf(business).filter(({ term, expansion }) => wanted.has(term) || wanted.has(expansion));
    return Promise.resolve(own);
  }
}
