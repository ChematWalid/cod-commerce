import { PACK_PRODUCT_TYPE } from '../domain/constants';
import { isPackRuleError } from '../domain/errors';
import { optionKey } from '../domain/option-key';
import type { PackComputation } from '../domain/pack-computation';
import { componentsOnSale } from '../domain/pack-computation';
import type { ComponentProduct } from '../domain/component-product';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PackUnitPrice, PriceLine } from '../domain/ports/pack-price-resolver-shape.port';
import { parseProductId } from '../domain/product-id';
import type { StoreScope } from '../domain/store-scope';
import { pricePack } from './pack-components';
import type { PackPorts } from './pack-ports';

/** A live pack product and what it costs now. */
interface LivePack {
  readonly product: ComponentProduct;
  readonly computed: PackComputation;
}

/** The unit price of `variantId` of a live pack, or `undefined` for a variant of another product. */
function unitPriceOf(live: LivePack, variantId: string): PackUnitPrice | undefined {
  const variant = live.product.variants.find((held) => held.id === variantId);
  if (variant === undefined) return undefined;
  const { computed } = live;
  const value = computed.sharedValues.find(
    (entry) => optionKey(entry.value) === optionKey(variant.optionValues[0] ?? ''),
  );
  const priced = computed.sharedValues.length === 0 ? computed : value;
  if (priced === undefined) return undefined;
  return {
    unitPrice: priced.price,
    originalPrice: priced.originalPrice,
    source: 'pack',
    weightGrams: computed.weightGrams,
  };
}

/**
 * Live unit prices of pack variants (D2204): what a quote charges, never the stored price. A line is left out when
 * its product is not a pack of the scope's store, its pack is `stale`, or a component no longer prices.
 */
export class PackPricesService {
  constructor(private readonly ports: PackPorts) {}

  /** Unit prices by variant id. */
  async resolve(
    ctx: OperationContext,
    scope: StoreScope,
    lines: readonly PriceLine[],
  ): Promise<Map<string, PackUnitPrice>> {
    const prices = new Map<string, PackUnitPrice>();
    for (const productId of new Set(lines.map((line) => line.productId))) {
      const live = await this.livePack(ctx, scope, productId);
      if (live === undefined) continue;
      for (const line of lines.filter((held) => held.productId === productId)) {
        const price = unitPriceOf(live, line.variantId);
        if (price !== undefined) prices.set(line.variantId, price);
      }
    }
    return prices;
  }

  private async livePack(ctx: OperationContext, scope: StoreScope, productId: string): Promise<LivePack | undefined> {
    const id = parseProductId(productId);
    if (id === undefined) return undefined;
    const pack = await this.ports.packs.findByProduct(ctx, scope, id);
    if (pack?.status !== 'ok') return undefined;
    const product = await this.ports.catalog.byId(ctx, scope, id);
    if (product?.type !== PACK_PRODUCT_TYPE) return undefined;
    try {
      const { products, computed } = await pricePack(this.ports, ctx, scope, { packProductId: id, definition: pack });
      return componentsOnSale(products) ? { product, computed } : undefined;
    } catch (error: unknown) {
      if (isPackRuleError(error)) return undefined;
      throw error;
    }
  }
}
