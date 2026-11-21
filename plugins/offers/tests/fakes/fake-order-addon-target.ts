import type { AddonOrder, OrderAddonTarget, PricedAddonLine } from '../../domain/ports/order-addon-target.port';
import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';

/** The orders of one store, as P3.S4's order source will answer them: each appended line is recorded. */
export class FakeOrderAddonTarget implements OrderAddonTarget {
  readonly appended: { scope: StoreScope; orderId: string; line: PricedAddonLine }[] = [];
  private readonly orders = new Map<string, { scope: StoreScope; order: AddonOrder }>();
  private failure: Error | undefined;

  /** Adds `order` to `scope`'s store. */
  add(scope: StoreScope, order: AddonOrder): void {
    this.orders.set(order.id, { scope, order });
  }

  /** Makes every later append fail with `error`. */
  failAppendsWith(error: Error): void {
    this.failure = error;
  }

  orderOf(_ctx: OperationContext, scope: StoreScope, orderId: string): Promise<AddonOrder | undefined> {
    const held = this.orders.get(orderId);
    const sameStore = held?.scope.businessId === scope.businessId && held.scope.storeId === scope.storeId;
    return Promise.resolve(sameStore ? held.order : undefined);
  }

  appendLine(_ctx: OperationContext, scope: StoreScope, orderId: string, line: PricedAddonLine): Promise<void> {
    if (this.failure !== undefined) return Promise.reject(this.failure);
    this.appended.push({ scope, orderId, line });
    return Promise.resolve();
  }
}
