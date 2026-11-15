import { ComponentNotFoundError, InvalidPackInputError } from './errors';
import type { PackComponentLine } from './pack';

/** An order line of a pack variant, as the order holds it before expansion; its total is `unitPrice × quantity`. */
export interface PackLine {
  /** The order line's own id, which each child names as its parent. */
  readonly itemId: string;
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
  /** The pack variant's unit price in whole DZD. */
  readonly unitPrice: number;
}

/** What expansion reads of a stored pack: its id (the bundle id) and its component lines. */
export interface ExpandablePack {
  readonly id: string;
  readonly components: readonly PackComponentLine[];
}

/** A variant of a component product and its list price in whole DZD. */
export interface ComponentVariantPrice {
  readonly productId: string;
  readonly variantId: string;
  readonly unitPrice: number;
}

/** What {@link expandPackLine} takes. */
export interface PackLineExpansionInput {
  readonly line: PackLine;
  readonly pack: ExpandablePack;
  /** Every sellable variant of the components, with its list price. */
  readonly componentPrices: readonly ComponentVariantPrice[];
  /** The buyer's variant per component product, for a line that pins none. */
  readonly chosenVariants?: ReadonlyMap<string, string>;
}

/** The pack line itself, marked with its bundle. */
export interface ExpandedPackParent extends PackLine {
  readonly bundleId: string;
}

/** One component line of an expanded pack (data model `orderItems.bundleId` / `packParentItemId`). */
export interface ExpandedPackChild {
  readonly productId: string;
  readonly variantId: string;
  /** Component quantity × line quantity. */
  readonly quantity: number;
  /** The component variant's list unit price, for display. */
  readonly unitPrice: number;
  /** This child's share of the parent total in whole DZD; the shares of all children sum to the parent total. */
  readonly lineTotal: number;
  readonly bundleId: string;
  readonly packParentItemId: string;
}

/** The parent line and its children. */
export interface PackLineExpansion {
  readonly parent: ExpandedPackParent;
  readonly children: readonly ExpandedPackChild[];
}

const isCount = (value: number): boolean => Number.isSafeInteger(value) && value >= 1;
const isAmount = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/** Of a component product's variants, the one wanted, or its only one when none is. */
function pickVariant(
  ofProduct: readonly ComponentVariantPrice[],
  wanted: string | undefined,
): ComponentVariantPrice | undefined {
  if (wanted !== undefined) return ofProduct.find((price) => price.variantId === wanted);
  return ofProduct.length === 1 ? ofProduct[0] : undefined;
}

/** The variant a component line ships: its pinned one, the buyer's choice, or its only variant. */
function variantOf(input: PackLineExpansionInput, component: PackComponentLine): ComponentVariantPrice {
  const ofProduct = input.componentPrices.filter((price) => price.productId === component.productId);
  const found = pickVariant(ofProduct, component.variantId ?? input.chosenVariants?.get(component.productId));
  if (found === undefined) throw new ComponentNotFoundError();
  return found;
}

/**
 * `total × weight / weights`, floored. In BigInt: int-max prices × 99 × 99 units overflow a double's exact range.
 */
function shareOf(total: number, weight: number, weights: number): number {
  if (weights === 0) return 0;
  return Number((BigInt(total) * BigInt(weight)) / BigInt(weights));
}

/**
 * Expands an order line of a pack into its component lines (D2205): `bundleId` is the pack id; a child's quantity is
 * its component quantity × the line quantity; the parent total is split in proportion to each component's list price
 * × quantity, floored, the remainder going to the first child, so the children's `lineTotal`s sum to the parent
 * total (all to the first child when every component is free). Throws `ComponentNotFoundError` when a component's
 * variant is not one of its own (or is ambiguous), `InvalidPackInputError` for a malformed line. For the P4 orders.
 */
export function expandPackLine(input: PackLineExpansionInput): PackLineExpansion {
  const { line, pack } = input;
  if (!isCount(line.quantity) || !isAmount(line.unitPrice) || pack.components.length === 0)
    throw new InvalidPackInputError();
  const resolved = pack.components.map((component) => ({ component, variant: variantOf(input, component) }));
  const weightsOf = resolved.map(({ component, variant }) => variant.unitPrice * component.quantity);
  const weights = weightsOf.reduce((sum, weight) => sum + weight, 0);
  const total = line.unitPrice * line.quantity;
  const shares = weightsOf.map((weight) => shareOf(total, weight, weights));
  const remainder = total - shares.reduce((sum, share) => sum + share, 0);
  const children = resolved.map(({ component, variant }, index) => ({
    productId: variant.productId,
    variantId: variant.variantId,
    quantity: component.quantity * line.quantity,
    unitPrice: variant.unitPrice,
    lineTotal: (shares[index] ?? 0) + (index === 0 ? remainder : 0),
    bundleId: pack.id,
    packParentItemId: line.itemId,
  }));
  return { parent: { ...line, bundleId: pack.id }, children };
}
