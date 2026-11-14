import type { SoldOutOrdersCommand } from '@cod/shared';
import { type CoreId, parseCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import { DEFAULT_PRODUCT_SETTINGS } from '../domain/product-settings';
import { allowsOrdersAfter, type SoldOutOrdersAction } from '../domain/sold-out';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { saveProductSettings } from './product-settings.service';

/** A sold-out product of the store and whether it still takes orders (D2108). */
export interface SoldOutProduct {
  readonly productId: CoreId;
  readonly title: string;
  readonly allowOutOfStockOrders: boolean;
}

/** The ids a command names, parsed; a malformed one names no product of the store, so it is left out (D2136). */
const parsedIds = (ids: readonly string[]): CoreId[] =>
  ids.flatMap((id) => {
    const parsed = parseCoreId(id);
    return parsed === undefined ? [] : [parsed];
  });

/** Compares two decimal ids by value. */
function byValue(left: CoreId, right: CoreId): number {
  const [first, second] = [BigInt(left), BigInt(right)];
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

/** Ids in ascending numeric order, the order product locks are taken in, so two bulk writes never deadlock. */
const inLockOrder = (ids: readonly CoreId[]): CoreId[] => [...ids].sort(byValue);

/**
 * The sold-out products of the caller's active store and "Stop orders" / "Resume orders" (AC6, D2108): either turns
 * `allowOutOfStockOrders` off or on for the products it names that are sold out now, or for every sold-out product of
 * the store when it names none. Another store's, another business's, a not-sold-out or a malformed id changes nothing.
 */
export class SoldOutService {
  constructor(private readonly ports: ProductPorts) {}

  async list(ctx: OperationContext, scope: StoreScope): Promise<readonly SoldOutProduct[]> {
    const ids = await this.ports.soldOut.allSoldOutIds(ctx, scope, scope.storeId);
    return this.describe(ctx, scope, ids);
  }

  stopOrders(ctx: OperationContext, scope: StoreScope, command: SoldOutOrdersCommand) {
    return this.apply(ctx, scope, command, 'stop');
  }

  resumeOrders(ctx: OperationContext, scope: StoreScope, command: SoldOutOrdersCommand) {
    return this.apply(ctx, scope, command, 'resume');
  }

  private async apply(
    ctx: OperationContext,
    scope: StoreScope,
    command: SoldOutOrdersCommand,
    action: SoldOutOrdersAction,
  ): Promise<readonly SoldOutProduct[]> {
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const locked = await this.lockAll(tx, await this.candidates(tx, scope, command.productIds));
      // Read again under the locks: a save in flight may have changed the flag since the candidates were read.
      const soldOut = await this.ports.soldOut.soldOutIds(tx, scope, scope.storeId, locked);
      const targets = locked.filter((id) => soldOut.has(id));
      const allowOutOfStockOrders = allowsOrdersAfter(action);
      for (const productId of targets) {
        await saveProductSettings(this.ports, tx, { scope, productId }, { allowOutOfStockOrders });
        await this.ports.events.publish(tx, scope, productId, 'updated');
      }
      return this.describe(tx, scope, targets);
    });
  }

  /** The sold-out products among the ids named, or every sold-out product of the store when none is named. */
  private async candidates(ctx: OperationContext, scope: StoreScope, named: readonly string[]): Promise<CoreId[]> {
    if (named.length === 0) return [...(await this.ports.soldOut.allSoldOutIds(ctx, scope, scope.storeId))];
    const ids = parsedIds(named);
    const soldOut = await this.ports.soldOut.soldOutIds(ctx, scope, scope.storeId, ids);
    return ids.filter((id) => soldOut.has(id));
  }

  /** Locks each live product of the store among `ids`, in id order, and returns those it locked. */
  private async lockAll(ctx: OperationContext, ids: readonly CoreId[]): Promise<CoreId[]> {
    const locked: CoreId[] = [];
    for (const id of inLockOrder(ids)) {
      if (await this.ports.products.lockForUpdate(ctx, id)) locked.push(id);
    }
    return locked;
  }

  private async describe(
    ctx: OperationContext,
    scope: StoreScope,
    ids: readonly CoreId[],
  ): Promise<readonly SoldOutProduct[]> {
    const described = await Promise.all(
      ids.map(async (productId) => {
        const [record, settings] = await Promise.all([
          this.ports.products.findOne(ctx, productId),
          this.ports.settings.findByProduct(ctx, scope, productId),
        ]);
        if (record === undefined) return [];
        const allowOutOfStockOrders = (settings ?? DEFAULT_PRODUCT_SETTINGS).allowOutOfStockOrders;
        return [{ productId, title: record.title, allowOutOfStockOrders }];
      }),
    );
    return described.flat();
  }
}
