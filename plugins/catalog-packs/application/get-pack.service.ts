import { PACK_PRODUCT_TYPE } from '../domain/constants';
import type { OperationContext } from '../domain/ports/operation-context';
import { parseProductId } from '../domain/product-id';
import type { StoreScope } from '../domain/store-scope';
import type { PackPorts } from './pack-ports';
import type { PackView } from './pack-view';

/** "Show a pack": its definition and what its product stores. */
export class GetPackService {
  constructor(private readonly ports: PackPorts) {}

  /** The pack of product `productId` in the scope's store, or `undefined` (none yet, not a pack, foreign, malformed). */
  async get(ctx: OperationContext, scope: StoreScope, productId: string): Promise<PackView | undefined> {
    const id = parseProductId(productId);
    if (id === undefined) return undefined;
    const product = await this.ports.catalog.byId(ctx, scope, id);
    if (product?.type !== PACK_PRODUCT_TYPE) return undefined;
    const pack = await this.ports.packs.findByProduct(ctx, scope, id);
    return pack === undefined ? undefined : { pack, price: product.price, weightGrams: product.weight };
  }
}
