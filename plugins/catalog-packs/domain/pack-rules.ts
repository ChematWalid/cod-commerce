import type { ComponentProduct } from './component-product';
import { PACK_PRODUCT_TYPE } from './constants';
import { ComponentIsPackError, ComponentNotFoundError } from './errors';
import type { PackComponentLine } from './pack';

/** A component line and the store-scoped read of its product (`undefined` when the store holds none). */
export interface ResolvedLine {
  readonly line: PackComponentLine;
  readonly product: ComponentProduct | undefined;
}

/** The product of one line once checked. */
function checkedProduct(packProductId: string | null, { line, product }: ResolvedLine): ComponentProduct {
  if (product === undefined) throw new ComponentNotFoundError();
  if (product.type === PACK_PRODUCT_TYPE || product.id === packProductId) throw new ComponentIsPackError();
  const pinned = line.variantId;
  if (pinned !== null && !product.variants.some((variant) => variant.id === pinned)) {
    throw new ComponentNotFoundError();
  }
  return product;
}

/**
 * The component products of a pack, in line order, once every line passes the store rules (D2202): its product is
 * in the store (another store's or business's reads as missing), is no pack and not the pack itself
 * (`packProductId`, `null` for a preview), and a pinned variant is one of its own.
 *
 * @throws {ComponentNotFoundError} for a missing product or a variant of another product.
 * @throws {ComponentIsPackError} for a pack component.
 */
export function checkComponents(packProductId: string | null, lines: readonly ResolvedLine[]): ComponentProduct[] {
  return lines.map((resolved) => checkedProduct(packProductId, resolved));
}
