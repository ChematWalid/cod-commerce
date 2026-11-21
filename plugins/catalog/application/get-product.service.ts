import { parseCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { type ProductView, viewOf } from './product-view';

/** "Open a product" of the caller's active store; another store's, another business's or a malformed id is none. */
export class GetProductService {
  constructor(private readonly ports: ProductPorts) {}

  async byId(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<ProductView | undefined> {
    const id = parseCoreId(rawId);
    if (id === undefined) return undefined;
    const record = await this.ports.products.findOne(ctx, id);
    return record === undefined ? undefined : viewOf(this.ports, ctx, scope, record);
  }
}
