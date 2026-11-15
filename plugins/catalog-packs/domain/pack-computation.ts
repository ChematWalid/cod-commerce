import { INT_COLUMN_MAX } from '@cod/shared';
import type { ComponentProduct } from './component-product';
import { DRAFT_STATUS } from './constants';
import { InvalidPackInputError } from './errors';
import type { PackComponentLine, PackDefinition } from './pack';
import { componentsSum, packPrice, type PricedComponent } from './pack-price';
import { packWeight } from './pack-weight';
import { sharedOptionMatrix } from './shared-option';

/** The price of one value of a shared-option pack, and its components' sum before the discount. */
export interface SharedValuePrice {
  readonly value: string;
  readonly price: number;
  readonly originalPrice: number;
}

/**
 * What a pack costs and weighs from its live components (D2202): `price` is the default variant's (the first
 * shared value's in `shared_option` mode), `originalPrice` the components' sum before the discount, and
 * `sharedValues` one entry per common value (empty in `per_component` mode).
 */
export interface PackComputation {
  readonly price: number;
  readonly originalPrice: number;
  readonly weightGrams: number;
  readonly sharedValues: readonly SharedValuePrice[];
}

/** The unit price of a line: its pinned variant's, else its product's (D2124 default). */
function unitPriceOf(line: PackComponentLine, product: ComponentProduct): number {
  const pinned = product.variants.find((variant) => variant.id === line.variantId);
  return pinned?.price ?? product.price;
}

function valuePrice(definition: PackDefinition, priced: readonly PricedComponent[], value: string): SharedValuePrice {
  return { value, price: packPrice(definition, priced), originalPrice: componentsSum(priced) };
}

/** One priced value per common value of the shared option, each component priced by its variant of that value. */
function sharedValuesOf(definition: PackDefinition, products: readonly ComponentProduct[]): SharedValuePrice[] {
  const matrix = sharedOptionMatrix(definition.packSharedOption ?? '', products);
  return matrix.values.map((value) => {
    const variantIds = matrix.variantsByValue.get(value) ?? [];
    const priced = products.map((product, index) => ({
      unitPrice: product.variants.find((variant) => variant.id === variantIds[index])?.price ?? product.price,
      quantity: definition.components[index]?.quantity ?? 0,
    }));
    return valuePrice(definition, priced, value);
  });
}

const isStorable = (value: number): boolean => Number.isSafeInteger(value) && value <= INT_COLUMN_MAX;

/**
 * Prices and weighs `definition` from its checked component products (same order as its lines).
 *
 * @throws {SharedOptionMissingError} or {NoCommonValueError} in `shared_option` mode (see {@link sharedOptionMatrix}).
 * @throws {InvalidPackInputError} when a price or the weight is beyond an int column.
 */
export function computePack(definition: PackDefinition, products: readonly ComponentProduct[]): PackComputation {
  const lines = definition.components;
  const priced = products.map((product, index) => ({
    unitPrice: lines[index] === undefined ? product.price : unitPriceOf(lines[index], product),
    quantity: lines[index]?.quantity ?? 0,
  }));
  const weightGrams = packWeight(
    definition,
    products.map((product, index) => ({ weightGrams: product.weight, quantity: lines[index]?.quantity ?? 0 })),
  );
  const sharedValues = definition.packVariantMode === 'shared_option' ? sharedValuesOf(definition, products) : [];
  const head = sharedValues[0] ?? valuePrice(definition, priced, '');
  const amounts = [
    weightGrams,
    head.originalPrice,
    ...sharedValues.flatMap((entry) => [entry.price, entry.originalPrice]),
    head.price,
  ];
  if (!amounts.every(isStorable)) throw new InvalidPackInputError();
  return { price: head.price, originalPrice: head.originalPrice, weightGrams, sharedValues };
}

/** True when every component is on sale: a draft component takes the pack out of pricing (stale, D2203). */
export const componentsOnSale = (products: readonly ComponentProduct[]): boolean =>
  products.every((product) => product.status !== DRAFT_STATUS);
