import type { ComponentProduct } from '../domain/component-product';
import { PACK_PRODUCT_TYPE } from '../domain/constants';
import { isPackRuleError } from '../domain/errors';
import type { PackRecord } from '../domain/pack';
import { componentsOnSale } from '../domain/pack-computation';
import { isWritten, packWriteOf } from '../domain/pack-write';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { pricePack } from './pack-components';
import type { PackPorts } from './pack-ports';

/**
 * Keeps stored pack prices true when a product changes (D2203): the packs holding it are repriced and their
 * product written when the values change; a component deleted, set to draft or losing the shared value marks the
 * pack `stale` and keeps its last price; a pack product that is gone or no longer a pack loses its pack rows. Each
 * pack runs in its own transaction under the pack's lock.
 */
export class RecomputePacksService {
  constructor(private readonly ports: PackPorts) {}

  /** Recomputes for a change of product `productId` of the scope's store. */
  async recompute(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    const own = await this.ports.packs.findByProduct(ctx, scope, productId);
    if (own !== undefined) await this.recomputeOne(ctx, scope, own.productId);
    for (const pack of await this.ports.packs.holding(ctx, scope, productId)) {
      await this.recomputeOne(ctx, scope, pack.productId);
    }
  }

  /** Reprices one pack from its row as stored once the pack's lock is held (D2241); a pack gone by then is done. */
  private recomputeOne(ctx: OperationContext, scope: StoreScope, packProductId: string): Promise<void> {
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.acquire(tx, packProductId);
      const pack = await this.ports.packs.findByProduct(tx, scope, packProductId);
      if (pack === undefined) return;
      const product = await this.ports.catalog.byId(tx, scope, pack.productId);
      if (product?.type !== PACK_PRODUCT_TYPE) {
        await this.ports.packs.deleteByProduct(tx, scope, pack.productId);
        return;
      }
      await this.reprice(tx, scope, { pack, product });
    });
  }

  private async reprice(
    ctx: OperationContext,
    scope: StoreScope,
    { pack, product }: { pack: PackRecord; product: ComponentProduct },
  ): Promise<void> {
    try {
      const { products, computed } = await pricePack(this.ports, ctx, scope, {
        packProductId: pack.productId,
        definition: pack,
      });
      if (!componentsOnSale(products)) {
        await this.mark(ctx, scope, pack, 'stale');
        return;
      }
      const write = packWriteOf(pack.productId, pack, computed);
      if (!isWritten(product, write)) await this.ports.catalog.writePackValues(ctx, scope, write);
      await this.mark(ctx, scope, pack, 'ok');
    } catch (error: unknown) {
      if (!isPackRuleError(error)) throw error;
      await this.mark(ctx, scope, pack, 'stale');
    }
  }

  private async mark(ctx: OperationContext, scope: StoreScope, pack: PackRecord, status: PackRecord['status']) {
    if (pack.status !== status) await this.ports.packs.setStatus(ctx, scope, { packId: pack.id, status });
  }
}
