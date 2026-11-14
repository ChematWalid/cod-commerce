import type { BrandCommand } from '@cod/shared';
import { BrandNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { type Brand, createBrand, renameBrand } from '../domain/taxonomy';
import type { ProductPorts } from './catalog-ports';
import { CatalogNames } from './catalog-names';

/**
 * The brands of the caller's active store (brief "Brands"): add, rename, list and delete. Deleting a brand clears it
 * from the store's products in the same transaction and tells later sessions they changed (D2127, D2140).
 */
export class BrandService {
  private readonly names: CatalogNames;

  constructor(private readonly ports: ProductPorts) {
    this.names = new CatalogNames(ports, ports.brands, {
      create: createBrand,
      rename: renameBrand,
      notFound: BrandNotFoundError,
    });
  }

  list(ctx: OperationContext, scope: StoreScope): Promise<readonly Brand[]> {
    return this.names.list(ctx, scope);
  }

  create(ctx: OperationContext, scope: StoreScope, command: BrandCommand): Promise<Brand> {
    return this.names.create(ctx, scope, command.name);
  }

  update(ctx: OperationContext, scope: StoreScope, rawId: string, command: BrandCommand): Promise<Brand> {
    return this.names.update(ctx, scope, rawId, command.name);
  }

  delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    return this.names.delete(ctx, scope, rawId, async (tx, id) => {
      const cleared = await this.ports.products.clearBrand(tx, id);
      for (const productId of cleared) await this.ports.events.publish(tx, scope, productId, 'updated');
    });
  }
}
