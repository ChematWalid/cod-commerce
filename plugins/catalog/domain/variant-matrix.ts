import { MAX_OPTION_GROUPS, MAX_OPTION_VALUES, MAX_VARIANTS } from '@cod/shared';
import {
  DuplicateOptionNameError,
  DuplicateOptionValueError,
  InvalidCatalogInputError,
  MatrixTooLargeError,
} from './errors';
import { skuSequence, variantName } from './sku';

/** One option of a product, e.g. Color with Red and Blue, values in display order. */
export interface OptionGroupSpec {
  readonly name: string;
  readonly values: readonly string[];
}

/** A live variant of the product: its option values in group order. */
export interface ExistingVariant {
  readonly id: string;
  readonly optionValues: readonly string[];
  readonly sku: string;
}

/** What the matrix is planned from. */
export interface MatrixInput {
  readonly productName: string;
  readonly baseSku: string | null;
  readonly basePrice: number;
  readonly groups: readonly OptionGroupSpec[];
  readonly existing: readonly ExistingVariant[];
}

/** A live variant that stays, with its name and option values in the current spelling; price, SKU and flags stay. */
export interface KeptVariant {
  readonly id: string;
  readonly name: string;
  readonly optionValues: readonly string[];
}

/** A variant to create with the product's defaults. */
export interface NewVariant {
  readonly name: string;
  readonly sku: string;
  readonly price: number;
  readonly optionValues: readonly string[];
}

/** The changes that bring the live variants in line with the options. */
export interface MatrixPlan {
  readonly keep: readonly KeptVariant[];
  readonly create: readonly NewVariant[];
  /** Ids of live variants whose combination is gone; they are soft-deleted (D2124). */
  readonly remove: readonly string[];
}

/** How two names or values compare: without case and Unicode form, so "Red", "red" and NFD forms are one. */
const comparable = (text: string): string => text.normalize('NFC').toLowerCase();

const combinationKey = (optionValues: readonly string[]): string => JSON.stringify(optionValues.map(comparable));

function hasRepeat(texts: readonly string[]): boolean {
  return new Set(texts.map(comparable)).size !== texts.length;
}

/** Refuses options over the caps of D2124, without values, or with a repeated name or value. */
function assertValidGroups(groups: readonly OptionGroupSpec[]): void {
  if (groups.length > MAX_OPTION_GROUPS || groups.some((group) => group.values.length > MAX_OPTION_VALUES)) {
    throw new MatrixTooLargeError();
  }
  if (groups.some((group) => group.values.length === 0)) {
    throw new InvalidCatalogInputError();
  }
  if (hasRepeat(groups.map((group) => group.name))) {
    throw new DuplicateOptionNameError();
  }
  if (groups.some((group) => hasRepeat(group.values))) {
    throw new DuplicateOptionValueError();
  }
  const variantCount = groups.reduce((count, group) => count * group.values.length, 1);
  if (variantCount > MAX_VARIANTS) {
    throw new MatrixTooLargeError();
  }
}

/** Every combination of one value per group, first group outermost; no groups give the one empty combination. */
function combinationsOf(groups: readonly OptionGroupSpec[]): readonly (readonly string[])[] {
  return groups.reduce<readonly (readonly string[])[]>(
    (combinations, group) => combinations.flatMap((prefix) => group.values.map((value) => [...prefix, value])),
    [[]],
  );
}

/** Live variants by combination; a second variant with the same combination is left out, so it is removed. */
function byCombination(existing: readonly ExistingVariant[]): ReadonlyMap<string, ExistingVariant> {
  const variants = new Map<string, ExistingVariant>();
  for (const variant of existing) {
    const key = combinationKey(variant.optionValues);
    if (!variants.has(key)) {
      variants.set(key, variant);
    }
  }
  return variants;
}

/** SKUs of the new variants: the product SKU itself for the default variant, else the next free `<sku>-n`. */
function newSkus(input: MatrixInput, kept: readonly ExistingVariant[], count: number): readonly string[] {
  if (input.groups.length === 0) {
    return Array.from({ length: count }, () => input.baseSku ?? '');
  }
  return skuSequence(input.baseSku, new Set(kept.map((variant) => variant.sku)), count);
}

/**
 * Plans the variants of a product from its options (brief AC1, D2124): one variant per combination in matrix order
 * (groups, then values), named `"<Product> - <v1> / <v2>"`. A live variant whose combination remains is kept with
 * its price, SKU and flags, so editing options never resets merchant edits; new combinations get the product price
 * and the next free SKUs; variants of removed combinations are removed. Without options there is one default
 * variant carrying the product SKU.
 *
 * @throws {MatrixTooLargeError} over 3 groups, 20 values per group or 100 variants.
 * @throws {DuplicateOptionNameError} / {DuplicateOptionValueError} on a repeat, ignoring case and Unicode form.
 * @throws {InvalidCatalogInputError} for an option without values.
 */
export function planVariantMatrix(input: MatrixInput): MatrixPlan {
  assertValidGroups(input.groups);
  const live = byCombination(input.existing);
  const kept: ExistingVariant[] = [];
  const keep: KeptVariant[] = [];
  const missing: (readonly string[])[] = [];
  for (const optionValues of combinationsOf(input.groups)) {
    const variant = live.get(combinationKey(optionValues));
    if (variant === undefined) {
      missing.push(optionValues);
      continue;
    }
    kept.push(variant);
    keep.push({ id: variant.id, name: variantName(input.productName, optionValues), optionValues });
  }
  const skus = newSkus(input, kept, missing.length);
  const create = missing.map((optionValues, index) => ({
    name: variantName(input.productName, optionValues),
    sku: skus[index] ?? '',
    price: input.basePrice,
    optionValues,
  }));
  const keptIds = new Set(kept.map((variant) => variant.id));
  const remove = input.existing.filter((variant) => !keptIds.has(variant.id)).map((variant) => variant.id);
  return { keep, create, remove };
}
