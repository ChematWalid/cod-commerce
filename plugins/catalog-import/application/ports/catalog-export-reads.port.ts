import type { ExportableProduct } from '../../domain/export-row';
import type { ExportFilter } from '../../domain/export-target';
import type { StoreScope } from '../../domain/store-scope';
import type { TaxonomyRefs } from './catalog-products.port';
import type { OperationContext } from './operation-context';

/** One page of the product ids a filter finds, ascending (D2218), and how many the filter finds in all. */
export interface ExportIdsPage {
  readonly ids: readonly string[];
  readonly nextSkip: number | null;
  readonly total: number;
}

/** Which page of a filter's ids to read. */
export interface ExportIdsPageRequest {
  readonly filter: ExportFilter;
  readonly skip: number;
  readonly take: number;
}

/**
 * What an export reads of catalog, through its explicit-scope facade (D2201): a product, the ids the product list's
 * filter finds, and the store's brand and tag names. Each call refuses a scope the ctx does not run in.
 */
export interface CatalogExportReadsPort {
  /** The product `productId` of the scope's store, or `undefined` (foreign, deleted, malformed). */
  product(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ExportableProduct | undefined>;
  /** One page of the ids `page.filter` finds in the scope's store. */
  idsPage(ctx: OperationContext, scope: StoreScope, page: ExportIdsPageRequest): Promise<ExportIdsPage>;
  /** The brands and tags of the scope's store. */
  taxonomyIndex(ctx: OperationContext, scope: StoreScope): Promise<TaxonomyRefs>;
}
