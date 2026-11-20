import { CatalogProductCommands } from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import type { CatalogProductsPort } from '../application/ports/catalog-products.port';
import { asOperationContext, type OperationContext } from '../application/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';

/**
 * {@link CatalogProductsPort} on catalog's explicit-scope facade (D2201): catalog's scope checks, locks and
 * `product.changed` apply. The scope comes from the tenant guard (request) or the job row (worker), never from the
 * ctx channel (D2236).
 */
@Injectable()
export class CatalogProductsAdapter implements CatalogProductsPort {
  constructor(private readonly commands: CatalogProductCommands) {}

  async storeContext(scope: StoreScope): Promise<OperationContext> {
    return asOperationContext(await this.commands.storeContext(scope));
  }
}
