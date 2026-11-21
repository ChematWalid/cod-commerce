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
 * pack runs in its own transaction under the pack's lock (a savepoint when the caller's context already holds one).
 */
export class RecomputePacksService {
  constructor(private readonly ports: PackPorts) {}

  /** Recomputes for a change of product `productId` of the scope's store. */
  async recompute(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    await this.recomputePacks(ctx, scope, await this.affectedPacks(ctx, scope, productId));
  }

  /**
   * The pack products a change of `productId` reprices: its own pack, then the packs holding it. Empty for a product
   * that is no pack and no component, which then needs no transaction, lock or store context (#260, D2282).
   */
  async affectedPacks(ctx: OperationContext, scope: StoreScope, productId: string): Promise<string[]> {
    const own = await this.ports.packs.findByProduct(ctx, scope, productId);
    const holding = await this.ports.packs.holding(ctx, scope, productId);
    return [...(own === undefined ? [] : [own.productId]), ...holding.map((pack) => pack.productId)];
  }

  /** Reprices each pack product of `packProductIds` in turn, each in its own transaction under its lock. */
  async recomputePacks(ctx: OperationContext, scope: StoreScope, packProductIds: readonly string[]): Promise<void> {
    for (const packProductId of packProductIds) await this.recomputeOne(ctx, scope, packProductId);
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
