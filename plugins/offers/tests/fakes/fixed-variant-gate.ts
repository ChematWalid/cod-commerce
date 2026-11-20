import type { CoreId } from '../../domain/core-id';
import { toCoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { GatedVariant, VariantGate } from '../../domain/ports/variant-gate.port';
import type { StoreScope } from '../../domain/store-scope';

/** A gated variant of `productId` at `listPrice`. */
export function aGatedVariant(variantId: string, productId: string, listPrice: number): GatedVariant {
  return { variantId: toCoreId(variantId), productId: toCoreId(productId), listPrice };
}

/**
 * A variant gate that accepts exactly the variants it was given (the store's sellable ones) and records what it was
 * asked, so a test can check the gate ran before any resolver.
 */
export class FixedVariantGate implements VariantGate {
  readonly asked: (readonly CoreId[])[] = [];
  private readonly sellable: ReadonlyMap<string, GatedVariant>;

  constructor(sellable: readonly GatedVariant[]) {
    this.sellable = new Map(sellable.map((variant) => [variant.variantId, variant]));
  }

  accept(_ctx: OperationContext, _scope: StoreScope, variantIds: readonly CoreId[]) {
    this.asked.push(variantIds);
    const accepted = new Map<string, GatedVariant>();
    for (const id of variantIds) {
      const variant = this.sellable.get(id);
      if (variant !== undefined) accepted.set(id, variant);
    }
    return Promise.resolve<ReadonlyMap<string, GatedVariant>>(accepted);
  }
}
