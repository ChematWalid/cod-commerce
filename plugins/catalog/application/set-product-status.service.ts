import type { ProductStatus } from '@cod/shared';
import { parseCoreId } from '../domain/core-id';
import { ProductNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import { optionSpecsOf } from '../domain/product';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { type ProductView, viewOf } from './product-view';

/**
 * "Set a product Active, Hidden or Draft" in the caller's active store (D2109): the adapter turns Vendure's `enabled`
 * off for a draft. Publishes `product.changed` with the `status` kind (D2127).
 */
export class SetProductStatusService {
  constructor(private readonly ports: ProductPorts) {}

  async set(ctx: OperationContext, scope: StoreScope, rawId: string, status: ProductStatus): Promise<ProductView> {
    const id = parseCoreId(rawId);
    if (id === undefined) throw new ProductNotFoundError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      if (!(await this.ports.products.lockForUpdate(tx, id))) throw new ProductNotFoundError();
      const record = await this.ports.products.findOne(tx, id);
      if (record === undefined) throw new ProductNotFoundError();
      const plan = {
        keep: record.variants.map(({ id: variantId, name, optionValues }) => ({ id: variantId, name, optionValues })),
        create: [],
        remove: [],
      };
      const saved = await this.ports.products.update(tx, id, {
        fields: { ...record, status },
        slug: null,
        matrix: { groups: optionSpecsOf(record), plan },
        variants: [],
      });
      if (saved === undefined) throw new ProductNotFoundError();
      await this.ports.events.publish(tx, scope, id, 'status');
      return viewOf(this.ports, tx, scope, saved);
    });
  }
}
