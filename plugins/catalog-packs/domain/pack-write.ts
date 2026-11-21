import type { ComponentProduct } from './component-product';
import type { PackDefinition } from './pack';
import type { PackComputation } from './pack-computation';

/** One value of the pack's option and the price of the pack variant carrying it. */
export interface PackOptionPrice {
  readonly value: string;
  readonly price: number;
}

/**
 * What a pack save writes into its product through catalog (D2203): price, weight and variant matrix. `sharedOption`
 * `null` is `per_component` (no option, one default variant at `price`).
 */
export interface PackWrite {
  readonly productId: string;
  readonly price: number;
  readonly weight: number;
  readonly sharedOption: { readonly name: string; readonly values: readonly PackOptionPrice[] } | null;
}

/** The write that stores `computed` into pack product `productId`. */
export function packWriteOf(productId: string, definition: PackDefinition, computed: PackComputation): PackWrite {
  const sharedOption =
    definition.packVariantMode === 'shared_option'
      ? {
          name: (definition.packSharedOption ?? '').trim(),
          values: computed.sharedValues.map(({ value, price }) => ({ value, price })),
        }
      : null;
  return { productId, price: computed.price, weight: computed.weightGrams, sharedOption };
}

/** True when `product` holds no option and one default variant at `price`. */
function holdsDefault(product: ComponentProduct, price: number): boolean {
  return product.optionGroups.length === 0 && product.variants.length === 1 && product.variants[0]?.price === price;
}

/**
 * True when `product` holds exactly the option and one variant per value at its price. Names and values compare
 * exactly, not by `optionKey`: catalog renames an option to the spelling it is sent, so a respelling is written
 * (D2202 "in the first component's spelling", D2241) and the next compare is equal again.
 */
function holdsShared(product: ComponentProduct, option: NonNullable<PackWrite['sharedOption']>): boolean {
  const [group, ...others] = product.optionGroups;
  if (group === undefined || others.length > 0 || group.name !== option.name) return false;
  if (group.values.join('\n') !== option.values.map((entry) => entry.value).join('\n')) return false;
  const priceOf = new Map(option.values.map((entry) => [entry.value, entry.price]));
  return (
    product.variants.length === option.values.length &&
    product.variants.every((variant) => priceOf.get(variant.optionValues[0] ?? '') === variant.price)
  );
}

/**
 * True when `product` already stores what `write` would write, so the save skips catalog (D2203). A product without
 * a weight does not hold 0 g: the first write stores the 0 so a save and a read answer the same weight (D2241).
 */
export function isWritten(product: ComponentProduct, write: PackWrite): boolean {
  if (product.price !== write.price || product.weight !== write.weight) return false;
  return write.sharedOption === null ? holdsDefault(product, write.price) : holdsShared(product, write.sharedOption);
}
