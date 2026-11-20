import { CATALOG_MAX_PAGE_SIZE, type Snowflake } from '@cod/shared';
import type { CoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import { type SkuMatch, skuMatchesOf } from '../domain/sku-match';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { criteriaOfFilter, type ProductListFilter } from './product-criteria';

/** One page of ids to read, by the list's filter (D2218). */
export interface ProductIdsPageRequest {
  readonly filter: ProductListFilter;
  readonly skip: number;
  /** At most `CATALOG_MAX_PAGE_SIZE`; a larger ask is cut to it. */
  readonly take: number;
}

/**
 * Product ids ascending, each once, where the next page starts (`null` after the last) and how many products the
 * filter finds in all (an export counts before it pages, D2257).
 */
export interface ProductIdsPage {
  readonly ids: readonly CoreId[];
  readonly nextSkip: number | null;
  readonly total: number;
}

/** A brand or a tag by id and name. */
export interface NamedRef {
  readonly id: Snowflake;
  readonly name: string;
}

/** The store's brands and tags, for matching names from a file or checking ids (D2209, D2213). */
export interface TaxonomyIndex {
  readonly brands: readonly NamedRef[];
  readonly tags: readonly NamedRef[];
}

const LAST_PAGE: ProductIdsPage = { ids: [], nextSkip: null, total: 0 };

/** Both Unicode forms of each SKU, so a case-only pre-filter (`contains`) still finds a stored NFC or NFD spelling. */
const searchFormsOf = (skus: readonly string[]): readonly string[] => [
  ...new Set(
    skus
      .map((sku) => sku.trim())
      .filter((sku) => sku !== '')
      .flatMap((sku) => [sku.normalize('NFC'), sku.normalize('NFD')]),
  ),
];

const namedRefsOf = (entries: readonly { readonly id: Snowflake; readonly name: string }[]): NamedRef[] =>
  entries.map(({ id, name }) => ({ id, name }));

/**
 * Lookups imports and exports run in one store (D2201): SKU matching, id paging and the brand and tag index. The
 * store is the context's channel and the scope's links; the facade checked both name the same store.
 */
export class ProductLookupService {
  constructor(private readonly ports: ProductPorts) {}

  /**
   * What each of `skus` names among the store's live products: a loose `contains` pre-filter in the store channel,
   * then an exact compare without case, outer spaces or Unicode form (D2201). Keyed by each SKU as given.
   */
  async findBySkus(
    ctx: OperationContext,
    _scope: StoreScope,
    skus: readonly string[],
  ): Promise<ReadonlyMap<string, SkuMatch>> {
    const forms = searchFormsOf(skus);
    const candidates = forms.length === 0 ? [] : await this.ports.lookup.findBySkus(ctx, forms);
    return skuMatchesOf(skus, candidates);
  }

  /**
   * One page of the ids the list's filter holds, ascending, each once (D2218). A product created meanwhile has the
   * largest id and comes last; one deleted meanwhile may shift a later page by one. A skip or take that is not a
   * finite number reads as the first page or the full page size.
   */
  async listIdsPage(ctx: OperationContext, scope: StoreScope, page: ProductIdsPageRequest): Promise<ProductIdsPage> {
    const criteria = await criteriaOfFilter(this.ports, ctx, scope, page.filter);
    if (criteria === null) return LAST_PAGE;
    const skip = Number.isFinite(page.skip) ? Math.max(0, Math.trunc(page.skip)) : 0;
    const take = Number.isFinite(page.take)
      ? Math.min(Math.max(1, Math.trunc(page.take)), CATALOG_MAX_PAGE_SIZE)
      : CATALOG_MAX_PAGE_SIZE;
    const found = await this.ports.lookup.listIds(ctx, { ...criteria, sort: 'id-asc', skip, take });
    const nextSkip = skip + take < found.totalItems ? skip + take : null;
    return { ids: [...new Set(found.ids)], nextSkip, total: found.totalItems };
  }

  /** Every brand and tag of the scope's store. */
  async taxonomyIndex(ctx: OperationContext, scope: StoreScope): Promise<TaxonomyIndex> {
    const [brands, tags] = await Promise.all([this.ports.brands.list(ctx, scope), this.ports.tags.list(ctx, scope)]);
    return { brands: namedRefsOf(brands), tags: namedRefsOf(tags) };
  }
}
