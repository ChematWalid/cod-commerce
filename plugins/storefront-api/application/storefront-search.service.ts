import type { StorefrontProductPage } from '@cod/shared';
import { DARIJA_SYNONYMS } from '../domain/darija-synonyms';
import { listingQueryOf, type RawListingQuery } from '../domain/listing-query';
import type { StorefrontSearchPort } from '../domain/ports/storefront-search.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StorefrontStorePort } from '../domain/ports/storefront-store.port';
import type { SynonymRepositoryPort } from '../domain/ports/synonym-repository.port';
import { queryVariants, searchQueryOf, synonymLookupTerms } from '../domain/search-query';
import { emptyProductPage, productPageOf } from './product-card';

/** What the storefront search reads through. */
export interface StorefrontSearchPorts {
  readonly stores: StorefrontStorePort;
  readonly search: StorefrontSearchPort;
  readonly synonyms: SynonymRepositoryPort;
}

/** A search request as the client sent it: the query and the page, all raw. */
export interface SearchRequest extends RawListingQuery {
  readonly q?: unknown;
}

/**
 * The storefront's product search (ADR 0014 Phase 1): the query in search normal form, widened by the business's
 * Darija synonyms (seeded on its first search), matched by word similarity over the store's projection, where `listed`
 * already hides hidden and sold-out-hidden products (D3205). The store is the storefront context's; a query too short
 * to run answers an empty page. Results are ranked by relevance, so `sort` is not read.
 */
export class StorefrontSearchService {
  constructor(private readonly ports: StorefrontSearchPorts) {}

  async search(ctx: OperationContext, request: SearchRequest): Promise<StorefrontProductPage> {
    const page = listingQueryOf(request);
    const query = searchQueryOf(request.q);
    if (query === undefined) return emptyProductPage(page);
    const { scope } = this.ports.stores.storeOf(ctx);
    await this.ports.synonyms.seedIfEmpty(ctx, scope, DARIJA_SYNONYMS);
    const synonyms = await this.ports.synonyms.matching(ctx, scope, synonymLookupTerms(query));
    const variants = queryVariants(query, synonyms);
    return productPageOf(await this.ports.search.search(ctx, scope, variants, page), page);
  }
}
