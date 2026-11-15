import type { PackVariantMode } from '@cod/shared';
import { ComponentNotFoundError, InvalidPackInputError } from './errors';
import { optionKey } from './option-key';
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

/** What expansion reads of a stored pack: its id (the bundle id), its variant mode and its component lines. */
export interface ExpandablePack {
  readonly id: string;
  readonly packVariantMode: PackVariantMode;
  readonly components: readonly PackComponentLine[];
  /**
   * `shared_option` only: each pack variant's value of the shared option, by pack variant id. The ordered pack variant
   * (`line.variantId`) picks the value, and so the variant of every component.
   */
  readonly sharedValues?: ReadonlyMap<string, string>;
}

/** A variant of a component product and its list price in whole DZD. */
export interface ComponentVariantPrice {
  readonly productId: string;
  readonly variantId: string;
  readonly unitPrice: number;
  /** `shared_option` packs: this variant's value of the shared option (matched trimmed, NFC, lower case). */
  readonly sharedValue?: string;
}

/** What {@link expandPackLine} takes. */
export interface PackLineExpansionInput {
  readonly line: PackLine;
  readonly pack: ExpandablePack;
  /** Every sellable variant of the components, with its list price. */
  readonly componentPrices: readonly ComponentVariantPrice[];
  /**
   * `per_component` packs: the buyer's variant per component product, for a component line that pins none. Ignored in
   * `shared_option` mode, where the ordered pack variant decides.
   */
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
const MAX_EXACT = BigInt(Number.MAX_SAFE_INTEGER);
const NOTHING = BigInt(0);

/** Of a component product's variants, the one wanted, or its only one when none is. */
function pickVariant(
  ofProduct: readonly ComponentVariantPrice[],
  wanted: string | undefined,
): ComponentVariantPrice | undefined {
  if (wanted !== undefined) return ofProduct.find((price) => price.variantId === wanted);
  return ofProduct.length === 1 ? ofProduct[0] : undefined;
}

/** Of a component product's variants, the only one carrying the ordered pack variant's shared value. */
function sharedVariant(
  input: PackLineExpansionInput,
  ofProduct: readonly ComponentVariantPrice[],
): ComponentVariantPrice | undefined {
  const value = input.pack.sharedValues?.get(input.line.variantId);
  if (value === undefined) return undefined;
  const carrying = ofProduct.filter(
    (price) => price.sharedValue !== undefined && optionKey(price.sharedValue) === optionKey(value),
  );
  return carrying.length === 1 ? carrying[0] : undefined;
}

/** The variant a component line ships: its pinned one, the shared value's, the buyer's choice, or its only one. */
function variantOf(input: PackLineExpansionInput, component: PackComponentLine): ComponentVariantPrice {
  const ofProduct = input.componentPrices.filter((price) => price.productId === component.productId);
  const found =
    component.variantId === null && input.pack.packVariantMode === 'shared_option'
      ? sharedVariant(input, ofProduct)
      : pickVariant(ofProduct, component.variantId ?? input.chosenVariants?.get(component.productId));
  if (found === undefined) throw new ComponentNotFoundError();
  if (!isAmount(found.unitPrice)) throw new InvalidPackInputError();
  return found;
}

/** The line's total in BigInt; a line of no unit, a malformed price or a total past the exact range is refused. */
function lineTotalOf(input: PackLineExpansionInput): bigint {
  const { line, pack } = input;
  const malformed =
    !isCount(line.quantity) ||
    !isAmount(line.unitPrice) ||
    pack.components.length === 0 ||
    pack.components.some((component) => !isCount(component.quantity * line.quantity) || !isCount(component.quantity));
  if (malformed) throw new InvalidPackInputError();
  const total = BigInt(line.unitPrice) * BigInt(line.quantity);
  if (total > MAX_EXACT) throw new InvalidPackInputError();
  return total;
}

/**
 * `total` split in proportion to `weights`, each share floored, the remainder (fewer than the shares) to the first;
 * all of it to the first when every weight is 0. In BigInt, so the shares sum to `total` exactly.
 */
function splitTotal(total: bigint, weights: readonly bigint[]): readonly bigint[] {
  const sum = weights.reduce((acc, weight) => acc + weight, NOTHING);
  const shares = weights.map((weight) => (sum === NOTHING ? NOTHING : (total * weight) / sum));
  const remainder = total - shares.reduce((acc, share) => acc + share, NOTHING);
  return shares.map((share, index) => (index === 0 ? share + remainder : share));
}

/**
 * Expands an order line of a pack into its component lines (D2205, D2243): `bundleId` is the pack id; a child's
 * quantity is its component quantity × the line quantity; the parent total is split in proportion to each component's
 * list price × quantity, floored, the remainder going to the first child, so the children's `lineTotal`s sum to the
 * parent total exactly (all to the first child when every component is free). A component line that pins no variant
 * ships, in `shared_option` mode, its variant carrying the ordered pack variant's value (`pack.sharedValues`,
 * `ComponentVariantPrice.sharedValue`); in `per_component` mode the buyer's choice or its only variant. Throws
 * `ComponentNotFoundError` when a component's variant cannot be found that way (or is not its own),
 * `InvalidPackInputError` for a malformed line, price or quantity, or a total past `Number.MAX_SAFE_INTEGER`.
 * For the P4 orders.
 */
export function expandPackLine(input: PackLineExpansionInput): PackLineExpansion {
  const { line, pack } = input;
  const total = lineTotalOf(input);
  const resolved = pack.components.map((component) => ({ component, variant: variantOf(input, component) }));
  const shares = splitTotal(
    total,
    resolved.map(({ component, variant }) => BigInt(variant.unitPrice) * BigInt(component.quantity)),
  );
  const children = resolved.map(({ component, variant }, index) => ({
    productId: variant.productId,
    variantId: variant.variantId,
    quantity: component.quantity * line.quantity,
    unitPrice: variant.unitPrice,
    lineTotal: Number(shares[index] ?? NOTHING),
    bundleId: pack.id,
    packParentItemId: line.itemId,
  }));
  return { parent: { ...line, bundleId: pack.id }, children };
}
