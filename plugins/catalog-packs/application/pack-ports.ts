import type { CatalogProductsPort } from '../domain/ports/catalog-products.port';
import type { PackRepositoryPort } from '../domain/ports/pack-repository.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** Every port the pack use cases run on, injected as one bundle. */
export interface PackPorts {
  readonly packs: PackRepositoryPort;
  readonly catalog: CatalogProductsPort;
  readonly transaction: TransactionPort;
}
