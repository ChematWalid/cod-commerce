import type { ProductStatus, Snowflake } from '@cod/shared';
import type { EditableProduct, ProductEditPatch } from '../../domain/bulk-edit-plan';
import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';

/** A brand or tag of the store by id and name. */
export interface TaxonomyRef {
  readonly id: Snowflake;
  readonly name: string;
}

/** The brands and tags of a store. */
export interface TaxonomyRefs {
  readonly brands: readonly TaxonomyRef[];
  readonly tags: readonly TaxonomyRef[];
}

/**
 * Catalog's explicit-scope facade as catalog-import uses it (D2201): every call runs catalog's own use cases, so its
 * validation, locks and `product.changed` apply, and refuses a scope the ctx does not run in. A write joins the
 * transaction `ctx` carries. Catalog refusals are thrown as catalog domain errors (`catalog.*` codes).
 */
export interface CatalogProductsPort {
  /**
   * The store-channel context a worker job runs in (D2212).
   * @throws a `catalog.product-not-found` domain error for an archived store, a suspended business or a store not of
   * the business (D2229, D2235)
   */
  storeContext(scope: StoreScope): Promise<OperationContext>;

  /** The product `productId` of the scope's store as a bulk edit reads it, or `undefined` (foreign, deleted, malformed). */
  byId(ctx: OperationContext, scope: StoreScope, productId: string): Promise<EditableProduct | undefined>;

  /** "Edit a product" with the fields of `patch`, under catalog's rules (a pack's price is refused, D2227). */
  update(ctx: OperationContext, scope: StoreScope, productId: string, patch: ProductEditPatch): Promise<void>;

  /** "Set a product Active, Hidden or Draft". */
  setStatus(ctx: OperationContext, scope: StoreScope, productId: string, status: ProductStatus): Promise<void>;

  /** The brands and tags of the scope's store. */
  taxonomyIndex(ctx: OperationContext, scope: StoreScope): Promise<TaxonomyRefs>;
}
