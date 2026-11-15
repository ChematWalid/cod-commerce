import type { ComponentProduct } from '../domain/component-product';
import { PACK_PRODUCT_TYPE } from '../domain/constants';
import { NotAPackError, PackNotFoundError } from '../domain/errors';
import type { PackDefinition } from '../domain/pack';
import { componentsOnSale } from '../domain/pack-computation';
import { isWritten, packWriteOf } from '../domain/pack-write';
import type { OperationContext } from '../domain/ports/operation-context';
import { parseProductId } from '../domain/product-id';
import type { StoreScope } from '../domain/store-scope';
import { pricePack } from './pack-components';
import type { PackPorts } from './pack-ports';
import type { PackView } from './pack-view';

/** "Save a pack": the pack product and the definition the merchant sent (already parsed by the API). */
export interface SavePackRequest {
  readonly productId: string;
  readonly definition: PackDefinition;
}

/**
 * "Save a pack" (D2202, D2203): checks the components against the store, prices the pack, stores it with its
 * components and writes the computed price, weight and variant matrix into the pack product through catalog (only
 * when they change), in one transaction under the pack's lock (D2241), so concurrent saves of one pack run one after
 * the other, and under catalog's locks on its components (D2242), so a component write cannot commit between this
 * save's read and its commit, unseen by the recompute it triggers. A draft component stores the pack `stale`.
 */
export class SavePackService {
  constructor(private readonly ports: PackPorts) {}

  /**
   * @throws {PackNotFoundError} for a product of another store or business, or a malformed id.
   * @throws {NotAPackError} for a product that is not of type `pack`.
   * @throws the component and pricing refusals of `pricePack`.
   */
  async save(ctx: OperationContext, scope: StoreScope, request: SavePackRequest): Promise<PackView> {
    const productId = parseProductId(request.productId);
    if (productId === undefined) throw new PackNotFoundError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const { definition } = request;
      await this.ports.lock.acquire(tx, productId);
      const componentIds = definition.components.map((line) => line.productId);
      await this.ports.catalog.lockForSave(tx, scope, { packProductId: productId, componentIds });
      const product = await this.packProduct(tx, scope, productId);
      const { products, computed } = await pricePack(this.ports, tx, scope, { packProductId: productId, definition });
      const status = componentsOnSale(products) ? 'ok' : 'stale';
      const pack = await this.ports.packs.save(tx, scope, { productId, status, definition });
      const write = packWriteOf(productId, definition, computed);
      if (!isWritten(product, write)) await this.ports.catalog.writePackValues(tx, scope, write);
      return { pack, price: computed.price, weightGrams: computed.weightGrams };
    });
  }

  private async packProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ComponentProduct> {
    const product = await this.ports.catalog.byId(ctx, scope, productId);
    if (product === undefined) throw new PackNotFoundError();
    if (product.type !== PACK_PRODUCT_TYPE) throw new NotAPackError();
    return product;
  }
}
