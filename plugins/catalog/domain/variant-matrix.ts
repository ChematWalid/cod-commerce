import { MAX_OPTION_GROUPS, MAX_OPTION_VALUES, MAX_VARIANTS, OPTION_NAME_MAX, OPTION_VALUE_MAX } from '@cod/shared';
import {
  DuplicateOptionNameError,
  DuplicateOptionValueError,
  InvalidCatalogInputError,
  MatrixTooLargeError,
} from './errors';
import { comparableText as comparable } from './comparable-text';
import { singleLineText } from './single-line-text';
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

const combinationKey = (optionValues: readonly string[]): string => JSON.stringify(optionValues.map(comparable));

function hasRepeat(texts: readonly string[]): boolean {
  return new Set(texts.map(comparable)).size !== texts.length;
}

/** The options trimmed; a blank, over-long or multi-line name or value is refused. */
function trimmedGroups(groups: readonly OptionGroupSpec[]): readonly OptionGroupSpec[] {
  return groups.map((group) => ({
    name: singleLineText(group.name, OPTION_NAME_MAX),
    values: group.values.map((value) => singleLineText(value, OPTION_VALUE_MAX)),
  }));
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

/**
 * SKUs of the new variants: the product SKU itself for the default variant, else the next free `<sku>-n`. Every
 * live variant's SKU is taken, those removed in this save too: they stay live until the save commits, and an old
 * order or label naming one must never point at a different combination.
 */
function newSkus(input: MatrixInput, groupCount: number, count: number): readonly string[] {
  if (groupCount === 0) {
    return Array.from({ length: count }, () => input.baseSku ?? '');
  }
  return skuSequence(input.baseSku, new Set(input.existing.map((variant) => variant.sku)), count);
}

/**
 * Plans the variants of a product from its options (brief AC1, D2124): one variant per combination in matrix order
 * (groups, then values), named `"<Product> - <v1> / <v2>"`. A live variant whose combination remains is kept with
 * its price, SKU and flags, so editing options never resets merchant edits; new combinations get the product price
 * and the next free SKUs (never one a live variant holds, removed ones included); variants of removed combinations
 * are removed. Without options there is one default variant carrying the product SKU. Names and values are trimmed.
 *
 * A variant is matched by its whole ordered combination, so adding or removing an option group replaces every
 * variant: none keeps its price, SKU or flags (Task 9 deviation, D2124). The editor warns before such a save.
 *
 * @throws {MatrixTooLargeError} over 3 groups, 20 values per group or 100 variants.
 * @throws {DuplicateOptionNameError} / {DuplicateOptionValueError} on a repeat, ignoring case and Unicode form.
 * @throws {InvalidCatalogInputError} for an option without values, a blank or over-long name or value, or a
 * generated SKU longer than `SKU_MAX`.
 */
export function planVariantMatrix(input: MatrixInput): MatrixPlan {
  const groups = trimmedGroups(input.groups);
  assertValidGroups(groups);
  const live = byCombination(input.existing);
  const kept: ExistingVariant[] = [];
  const keep: KeptVariant[] = [];
  const missing: (readonly string[])[] = [];
  for (const optionValues of combinationsOf(groups)) {
    const variant = live.get(combinationKey(optionValues));
    if (variant === undefined) {
      missing.push(optionValues);
      continue;
    }
    kept.push(variant);
    keep.push({ id: variant.id, name: variantName(input.productName, optionValues), optionValues });
  }
  const skus = newSkus(input, groups.length, missing.length);
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
