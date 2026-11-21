import type { ComponentProduct } from '../domain/component-product';
import type { PackDefinition } from '../domain/pack';
import { computePack, type PackComputation } from '../domain/pack-computation';
import { checkComponents } from '../domain/pack-rules';
import type { OperationContext } from '../domain/ports/operation-context';
import { parseProductId } from '../domain/product-id';
import type { StoreScope } from '../domain/store-scope';
import type { PackPorts } from './pack-ports';

/** A definition priced from its live components, with the component products it was priced from. */
export interface PricedPack {
  readonly products: readonly ComponentProduct[];
  readonly computed: PackComputation;
}

/**
 * Reads the product of every component line in the scope's store; a malformed id reads as missing. One read after
 * another: `ctx` may carry a transaction, whose one connection runs one query at a time (#260, D2282).
 */
async function readComponents(
  ports: PackPorts,
  ctx: OperationContext,
  scope: StoreScope,
  definition: PackDefinition,
): Promise<{ line: PackDefinition['components'][number]; product: ComponentProduct | undefined }[]> {
  const lines: { line: PackDefinition['components'][number]; product: ComponentProduct | undefined }[] = [];
  for (const line of definition.components) {
    const id = parseProductId(line.productId);
    lines.push({ line, product: id === undefined ? undefined : await ports.catalog.byId(ctx, scope, id) });
  }
  return lines;
}

/**
 * Checks `definition`'s components against the store (D2202) and prices it. `packProductId` is the pack's own
 * product, refused as a component; `null` for a preview.
 *
 * @throws {ComponentNotFoundError}, {ComponentIsPackError}, {SharedOptionMissingError}, {NoCommonValueError} or
 * {InvalidPackInputError} (see `checkComponents` and `computePack`).
 */
export async function pricePack(
  ports: PackPorts,
  ctx: OperationContext,
  scope: StoreScope,
  pack: { readonly packProductId: string | null; readonly definition: PackDefinition },
): Promise<PricedPack> {
  const lines = await readComponents(ports, ctx, scope, pack.definition);
  const products = checkComponents(pack.packProductId, lines);
  return { products, computed: computePack(pack.definition, products) };
}
