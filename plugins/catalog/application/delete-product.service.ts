import { parseCoreId } from '../domain/core-id';
import { ProductNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';

/**
 * "Delete a product" of the caller's active store: Vendure soft-deletes it and its variants, and its links and
 * settings rows go with it in the same transaction; `product.changed` tells later sessions (D2127).
 */
export class DeleteProductService {
  constructor(private readonly ports: ProductPorts) {}

  async delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    const id = parseCoreId(rawId);
    if (id === undefined) throw new ProductNotFoundError();
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      if (!(await this.ports.products.softDelete(tx, id))) throw new ProductNotFoundError();
      await this.ports.tags.replaceProductTags(tx, scope, id, []);
      await this.ports.highlights.replaceProductHighlights(tx, scope, id, []);
      await this.ports.collections.deleteProductLinks(tx, scope, id);
      await this.ports.settings.delete(tx, scope, id);
      await this.ports.events.publish(tx, scope, id, 'deleted');
    });
  }
}
