import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';

/**
 * Catalog's explicit-scope facade as catalog-import uses it (D2201). Task 6 needs only the worker's store context;
 * the bulk edit, export and import tasks add the reads and writes they call.
 */
export interface CatalogProductsPort {
  /**
   * The store-channel context a worker job runs in (D2212).
   * @throws a `catalog.product-not-found` domain error for an archived store, a suspended business or a store not of
   * the business (D2229, D2235)
   */
  storeContext(scope: StoreScope): Promise<OperationContext>;
}
