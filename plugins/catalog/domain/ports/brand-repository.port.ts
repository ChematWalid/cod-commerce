import type { CatalogNameRepositoryPort } from './catalog-name-repository.port';

/**
 * Where a store's brands are kept. A product names its brand in the `brandId` custom field (D2100), so clearing a
 * deleted brand from products is the product adapter's work (D2140), not this port's.
 */
export type BrandRepositoryPort = CatalogNameRepositoryPort;
