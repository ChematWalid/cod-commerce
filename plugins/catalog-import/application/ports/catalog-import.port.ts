import type { ImportCreate, ImportTargetProduct, ImportUpdate } from '../../domain/import-writes';
import type { SkuLookup } from '../../domain/plan-lookups';
import type { StoreScope } from '../../domain/store-scope';
import type { TaxonomyRefs } from './catalog-products.port';
import type { LinkedOrigin } from './link-job.port';
import type { OperationContext } from './operation-context';

/**
 * What an import reads and writes of catalog, through its explicit-scope facade (D2201): each call runs catalog's own
 * use cases (validation, locks, `product.changed`) and refuses a scope the ctx does not run in. A write joins the
 * transaction `ctx` carries; catalog's refusals are thrown as catalog domain errors (`catalog.*` codes).
 */
export interface CatalogImportPort {
  /** What each SKU names in the scope's store, keyed by the SKU as given (another store's or business's: none). */
  findBySkus(
    ctx: OperationContext,
    scope: StoreScope,
    skus: readonly string[],
  ): Promise<ReadonlyMap<string, SkuLookup>>;
  /** The product `productId` of the scope's store with its variants, or `undefined` (foreign, deleted, malformed). */
  product(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ImportTargetProduct | undefined>;
  /** The brands and tags of the scope's store. */
  taxonomyIndex(ctx: OperationContext, scope: StoreScope): Promise<TaxonomyRefs>;
  /** "Create a product" with its variants' own SKUs and prices (D2219); answers the new product's id. */
  create(ctx: OperationContext, scope: StoreScope, command: ImportCreate): Promise<string>;
  /** "Edit a product" with the import's changes. */
  update(ctx: OperationContext, scope: StoreScope, productId: string, change: ImportUpdate): Promise<void>;
}

/** One confirmed import's activity row (action `catalog.products.import`, entity `catalog-job`): its counts. */
export interface ImportActivity {
  readonly scope: StoreScope;
  readonly importId: string;
  readonly created: number;
  readonly updated: number;
  readonly failed: number;
  /** The confirming administrator; null when removed since (rbac stores no actor then). */
  readonly administratorId: number | null;
}

/** The business activity log, written in the caller's transaction: the row commits with the import's end. */
export interface ImportActivityPort {
  recordImport(ctx: OperationContext, activity: ImportActivity): Promise<void>;
}

/** Where an imported product came from (D2210): its job and the image links its rows carried. */
export interface ImportedOrigin {
  readonly productId: string;
  readonly importJobId: string;
  readonly imageUrls: readonly string[];
  /** Whether the import created the product (source `import`) or updated one. */
  readonly created: boolean;
}

/** Writes `catalog_product_origin` rows of the scope's store, in the caller's transaction. */
export interface ProductOriginWrites {
  recordImport(ctx: OperationContext, scope: StoreScope, origin: ImportedOrigin): Promise<void>;
  /** A product a link import made: source `link`, flagged for image review, with the page's image links (D2214). */
  recordLink(ctx: OperationContext, scope: StoreScope, origin: LinkedOrigin): Promise<void>;
}
